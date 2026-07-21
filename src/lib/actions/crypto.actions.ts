
      
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { createTransaction } from './transaction.actions';
import { createNotification } from './notification.actions';
import type { User, CryptoBalance, Currency, CryptoTransaction } from '../types';
import { calculateTransactionFee } from './wallet.actions';
import { getLiveCryptoPrice as getLiveCryptoPriceFromService } from '@/services/crypto-pricing';
import { verifyCurrentUserPin } from './auth.actions';
import crypto from 'crypto';
import { getNewBitcoinAddress } from '@/services/bitcoin';
import { getAuthenticatedUser } from './user.actions';
import { sendEmail } from '@/services/email';
import type { PoolClient } from 'pg';

const SUPPORTED_CRYPTOS = ['BTC', 'ETH', 'USDT_ERC20', 'USDT_TRC20', 'AFC'];

/**
 * Fetches or generates unique cryptocurrency deposit addresses for a user.
 * For Bitcoin (BTC), it calls a real Bitcoin Core node.
 * For other currencies, it generates a mock unique address.
 * 
 * @param userId - The ID of the user.
 * @returns A promise that resolves to a record mapping currency codes to their addresses.
 */
export async function getUserCryptoAddresses(userId: number): Promise<Record<string, string>> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows } = await connection.query('SELECT currency_code, address FROM user_crypto_addresses WHERE user_id = $1', [userId]);
        const addresses: Record<string, string> = {};
        rows.forEach(row => {
            addresses[row.currency_code] = row.address;
        });

        const missingCryptos = SUPPORTED_CRYPTOS.filter(crypto => !addresses[crypto]);

        if (missingCryptos.length > 0) {
            console.log(`[Crypto] Generating new addresses for user ${userId} for: ${missingCryptos.join(', ')}`);
            for (const cryptoCurrency of missingCryptos) {
                let newAddress: string;
                if (cryptoCurrency === 'BTC') {
                    // Call the real Bitcoin Core RPC service
                    newAddress = await getNewBitcoinAddress(`user_${userId}`);
                } else {
                    // Generate a unique, deterministic (but not cryptographically secure) address for other cryptos as a placeholder
                    const hash = crypto.createHash('sha256').update(`${cryptoCurrency}-${userId}-cashpay`).digest('hex');
                    newAddress = `${cryptoCurrency.slice(0,3)}_${hash.slice(0, 16)}`;
                }
                
                await connection.query('INSERT INTO user_crypto_addresses (user_id, currency_code, address) VALUES ($1, $2, $3)', [userId, cryptoCurrency, newAddress]);
                addresses[cryptoCurrency] = newAddress;
            }
        }
        
        await connection.query('COMMIT');
        return addresses;
    } catch (error) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'getting/generating user crypto addresses');
        // On critical error, we can't be sure what addresses are valid, so return empty
        console.error("Critical error in getUserCryptoAddresses:", dbError.error);
        return {};
    } finally {
        connection.release();
    }
}


interface HandleDepositArgs {
    userId: number;
    currency: string;
    amount: number;
    address: string;
}

export async function handleCryptoDeposit(args: HandleDepositArgs): Promise<{ success: boolean; message: string }> {
    const { userId, currency, amount, address } = args;

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const txHash = `mock_tx_${Date.now()}`;
        const requiredConfirmations = 3;

        const { rows } = await connection.query(`
            INSERT INTO crypto_deposits (user_id, currency_code, amount, tx_hash, status, confirmations, required_confirmations)
            VALUES ($1, $2, $3, $4, 'unconfirmed', 0, $5) RETURNING id
        `, [userId, currency, amount, txHash, requiredConfirmations]);
        
        const depositId = rows[0].id;

        // This simulates the background job that watches the blockchain
        simulateConfirmations(depositId, userId, amount, currency, requiredConfirmations);

        await connection.query('COMMIT');
        return { success: true, message: "Simulation de dépôt lancée. Vous recevrez une notification lorsque les fonds seront crédités." };
    } catch (error) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'handling crypto deposit');
        return { success: false, message: dbError.error };
    } finally {
        connection.release();
    }
}

async function simulateConfirmations(depositId: number, userId: number, cryptoAmount: number, cryptoCurrency: string, requiredConfirmations: number) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // Simulate confirmations
        for (let i = 1; i <= requiredConfirmations; i++) {
            await new Promise(res => setTimeout(res, 1000)); // 1s delay per confirmation
            await connection.query('UPDATE crypto_deposits SET confirmations = $1 WHERE id = $2', [i, depositId]);
            console.log(`[Crypto Sim] Deposit ${depositId} has ${i} confirmations.`);
        }
        
        // Get live exchange rate
        const rateResult = await getLiveCryptoPrice(cryptoCurrency, 'USD');
        if (!rateResult.success || !rateResult.price) {
            throw new Error(`Taux de change non trouvé pour ${cryptoCurrency}.`);
        }
        const exchangeRate = rateResult.price;
        const fiatValue = cryptoAmount * exchangeRate;
        
        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) throw new Error("Utilisateur non trouvé pour le crédit final.");
        const user = userRows[0] as User;

        // Calculate and deduct fees
        const fee = await calculateTransactionFee(fiatValue, 'USD', 'DP_CRYPTO', user.country, connection);
        const finalCreditAmount = fiatValue - fee;
        
        if (finalCreditAmount <= 0) {
             throw new Error(`Le montant après frais est nul ou négatif. Montant: ${fiatValue}, Frais: ${fee}`);
        }

        // Credit the user's FIAT wallet
        const transactionResult = await createTransaction({
            user: user,
            typeCode: 'DP_CRYPTO',
            amount: finalCreditAmount,
            currency: 'USD',
            description: `Dépôt de ${cryptoAmount.toFixed(6)} ${cryptoCurrency} (Valeur: ${fiatValue.toFixed(2)} USD)`,
            metadata: { 
                crypto_deposit_id: depositId,
                crypto_amount: cryptoAmount,
                crypto_currency: cryptoCurrency,
                exchange_rate: exchangeRate,
                fee_amount_usd: fee,
                original_fiat_amount: fiatValue
            },
            status: 'Completed',
            connection
        });
        
        if (!transactionResult.success) {
            throw new Error(transactionResult.error || "Échec de la transaction de crédit fiat.");
        }

        // Update deposit status to confirmed
        await connection.query('UPDATE crypto_deposits SET status = $1 WHERE id = $2', ['confirmed', depositId]);

        await connection.query('COMMIT');
        console.log(`[Crypto Sim] User ${userId} credited with ${finalCreditAmount.toFixed(2)} USD.`);

        // Notify user via Email
        if (user.email) {
            await sendEmail(user.email, 'Dépôt Crypto Confirmé', 'general', {
                title: 'Dépôt Réussi',
                greeting: `Bonjour ${user.first_name},`,
                message: `Votre dépôt de <strong>${cryptoAmount.toFixed(6)} ${cryptoCurrency}</strong> a été confirmé. <br/>Après conversion et frais, <strong>${finalCreditAmount.toFixed(2)} USD</strong> ont été crédités sur votre portefeuille principal.`,
                buttonText: 'Voir mes transactions',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/transactions`,
                signature: "L'équipe CashPay"
            });
        }

        // Notify user in-app
        await createNotification(
            userId,
            'Dépôt Réussi',
            `Votre dépôt de ${cryptoAmount.toFixed(6)} ${cryptoCurrency} a été confirmé et ${finalCreditAmount.toFixed(2)} USD ont été crédités sur votre compte.`,
            'general'
        );

    } catch (error) {
        console.error(`[Crypto Sim] Failed to credit user for deposit ${depositId}:`, error);
        await connection.query('ROLLBACK');
    } finally {
        connection.release();
    }
}


interface WithdrawalRequestArgs {
  user: User;
  amount: number;
  currency: string;
  recipientAddress: string;
}

export async function requestCryptoWithdrawal(args: WithdrawalRequestArgs): Promise<{ success: boolean; error?: string; }> {
  const { user, amount, currency, recipientAddress } = args;
  
  const connection = await db.getConnection();
  try {
    await connection.query('BEGIN');

    // 1. Check & lock user's crypto balance
    const { rows: balanceRows } = await connection.query(
        'SELECT balance FROM user_crypto_balances WHERE user_id = $1 AND currency_code = $2 FOR UPDATE', 
        [user.id, currency]
    );

    const currentBalance = balanceRows.length > 0 ? parseFloat(balanceRows[0].balance) : 0;
    if (currentBalance < amount) {
        throw new Error("Solde crypto insuffisant pour ce retrait.");
    }
    
    // 2. Debit the user's crypto balance
    await connection.query(
        'UPDATE user_crypto_balances SET balance = balance - $1 WHERE user_id = $2 AND currency_code = $3', 
        [amount, user.id, currency]
    );

    // 3. Record the withdrawal request for the backend worker to process
    const simulatedTxHash = `mock_tx_${crypto.randomBytes(32).toString('hex')}`;
    
    const withdrawalData = {
        user_id: user.id,
        currency_code: currency,
        amount,
        recipient_address: recipientAddress,
        status: 'pending', // Will be 'processing', then 'completed' or 'failed' by a worker
        tx_hash: simulatedTxHash
    };
    await connection.query('INSERT INTO crypto_withdrawals (user_id, currency_code, amount, recipient_address, status, tx_hash) VALUES ($1, $2, $3, $4, $5, $6)', Object.values(withdrawalData));

    await connection.query('COMMIT');
    
    console.log(`[Crypto Withdrawal] New withdrawal request created for user ${user.id}: ${amount} ${currency} to ${recipientAddress}. TxHash: ${simulatedTxHash}`);
    
    // Send email notification
    if (user.email) {
      await sendEmail(user.email, 'Demande de Retrait Crypto Initiée', 'general', {
        title: 'Demande de Retrait Reçue',
        greeting: `Bonjour ${user.first_name},`,
        message: `Nous avons bien reçu votre demande de retrait de <strong>${amount.toFixed(6)} ${currency}</strong> vers l'adresse ${recipientAddress}.<br/>L'opération est en cours de traitement.`,
        buttonText: 'Voir mes transactions',
        buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/transactions`,
        signature: "L'équipe CashPay"
      });
    }

    return { success: true };
  } catch (error: any) {
    await connection.query('ROLLBACK');
    const dbError = await handleDbError(error, 'requesting crypto withdrawal');
    return { success: false, error: dbError.error || error.message };
  } finally {
    connection.release();
  }
}

export async function getCryptoBalances(userId: number): Promise<CryptoBalance[]> {
    try {
        const { rows } = await db.query('SELECT currency_code, balance FROM user_crypto_balances WHERE user_id = $1', [userId]);
        const balancesMap = new Map(rows.map(row => [row.currency_code, parseFloat(row.balance)]));

        const allBalances = SUPPORTED_CRYPTOS.map(code => ({
            currency_code: code,
            balance: balancesMap.get(code) || 0,
        }));

        return allBalances;
    } catch (error) {
        handleDbError(error, 'fetching crypto balances');
        return SUPPORTED_CRYPTOS.map(code => ({ currency_code: code, balance: 0 }));
    }
}

export async function getCryptoHistory(userId: number): Promise<CryptoTransaction[]> {
    try {
        const { rows: depositRows } = await db.query('SELECT id, \'deposit\' as type, currency_code, amount, tx_hash, status, created_at FROM crypto_deposits WHERE user_id = $1', [userId]);
        const { rows: withdrawalRows } = await db.query('SELECT id, \'withdrawal\' as type, currency_code, amount, tx_hash, status, created_at FROM crypto_withdrawals WHERE user_id = $1', [userId]);

        const combined = [...depositRows, ...withdrawalRows];
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return combined.slice(0, 50).map(row => ({
            ...row,
            amount: parseFloat(row.amount),
        })) as CryptoTransaction[];
    } catch (error) {
        handleDbError(error, 'fetching crypto history');
        return [];
    }
}

export async function getLiveCryptoPrice(cryptoSymbol: string, fiatSymbol: string) {
    return getLiveCryptoPriceFromService(cryptoSymbol, fiatSymbol);
}

interface ConvertCryptoFiatArgs {
  userId: number;
  pin: string;
  fromCurrency: string;
  fromAmount: number;
}
export async function convertCryptoToFiat(args: ConvertCryptoFiatArgs): Promise<{ success: boolean; error?: string }> {
     const { userId, pin, fromCurrency, fromAmount } = args;

    const pinVerification = await verifyCurrentUserPin(pin);
    if (!pinVerification.success) {
        return { success: false, error: pinVerification.error };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Check & lock crypto balance
        const { rows: balanceRows } = await connection.query('SELECT balance FROM user_crypto_balances WHERE user_id = $1 AND currency_code = $2 FOR UPDATE', [userId, fromCurrency]);
        const currentBalance = balanceRows.length > 0 ? parseFloat(balanceRows[0].balance) : 0;
        if (currentBalance < fromAmount) throw new Error("Solde crypto insuffisant.");

        // 2. Get conversion rate
        const rateResult = await getLiveCryptoPrice(fromCurrency, 'USD');
        if (!rateResult.success || !rateResult.price) throw new Error(`Taux de change non disponible pour ${fromCurrency}.`);
        const toAmount = fromAmount * rateResult.price;

        // 3. Debit crypto balance
        await connection.query('UPDATE user_crypto_balances SET balance = balance - $1 WHERE user_id = $2 AND currency_code = $3', [fromAmount, userId, fromCurrency]);

        // 4. Credit USD fiat balance
        await connection.query(`UPDATE wallets SET balances = jsonb_set(COALESCE(balances, '{}'::jsonb), '{USD}', (COALESCE((balances->>'USD')::numeric, 0) + $1)::text::jsonb) WHERE user_id = $2`, [toAmount, userId]);

        // 5. Log the transaction (optional, but good practice)
        // This could be a separate transaction type or logged in a specific table for conversions

        await connection.query('COMMIT');

        const { rows: userRows } = await db.query('SELECT first_name, email FROM users WHERE id = $1', [userId]);
        if (userRows.length > 0 && userRows[0].email) {
            await sendEmail(userRows[0].email, 'Confirmation de Conversion', 'general', {
                title: 'Conversion Réussie',
                greeting: `Bonjour ${userRows[0].first_name},`,
                message: `Votre conversion de <strong>${fromAmount.toFixed(6)} ${fromCurrency}</strong> en <strong>${toAmount.toFixed(2)} USD</strong> a été effectuée avec succès.`,
                buttonText: 'Voir mes transactions',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/transactions`,
                signature: "L'équipe CashPay"
            });
        }

        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'converting crypto to fiat');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

interface ConvertFiatCryptoArgs {
    userId: number;
    pin: string;
    fromCurrency: string;
    fromAmount: number;
    toCrypto: string;
}
export async function convertFiatToCrypto(args: ConvertFiatCryptoArgs): Promise<{ success: boolean, error?: string}> {
     const { userId, pin, fromCurrency, fromAmount, toCrypto } = args;

    const pinVerification = await verifyCurrentUserPin(pin);
    if (!pinVerification.success) {
        return { success: false, error: pinVerification.error };
    }
    
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: walletRows } = await connection.query('SELECT balances FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
        if (!walletRows.length) throw new Error('Portefeuille non trouvé.');
        
        const balances = JSON.parse(walletRows[0].balances || '{}');
        const currentFiatBalance = balances[fromCurrency] || 0;
        if (currentFiatBalance < fromAmount) throw new Error(`Solde ${fromCurrency} insuffisant.`);
        
        const rateResult = await getLiveCryptoPrice(toCrypto, fromCurrency);
        if (!rateResult.success || !rateResult.price) throw new Error(`Taux de change non disponible pour ${toCrypto}.`);
        const toAmount = fromAmount / rateResult.price;

        balances[fromCurrency] -= fromAmount;
        await connection.query('UPDATE wallets SET balances = $1 WHERE user_id = $2', [JSON.stringify(balances), userId]);
        
        await connection.query(
            `INSERT INTO user_crypto_balances (user_id, currency_code, balance) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, currency_code) DO UPDATE SET balance = user_crypto_balances.balance + $3`,
            [userId, toCrypto, toAmount]
        );
        
        await connection.query('COMMIT');

        const { rows: userRows } = await db.query('SELECT first_name, email FROM users WHERE id = $1', [userId]);
        if (userRows.length > 0 && userRows[0].email) {
            await sendEmail(userRows[0].email, 'Confirmation d\'Achat Crypto', 'general', {
                title: 'Achat Réussi',
                greeting: `Bonjour ${userRows[0].first_name},`,
                message: `Votre achat de <strong>${toAmount.toFixed(6)} ${toCrypto}</strong> avec <strong>${fromAmount.toFixed(2)} ${fromCurrency}</strong> a été effectué avec succès.`,
                buttonText: 'Voir mes transactions',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/transactions`,
                signature: "L'équipe CashPay"
            });
        }

        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'converting fiat to crypto');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}


export async function activateCryptoWallet(userId: number): Promise<{ success: boolean; user?: User; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: userRows } = await connection.query('SELECT is_crypto_active, country FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) throw new Error("Utilisateur non trouvé.");
        if (userRows[0].is_crypto_active) {
            await connection.query('ROLLBACK');
            const fullUser = await getAuthenticatedUser();
            return { success: true, user: fullUser || undefined };
        }
        
        // TODO: Vérifier si le pays autorise la crypto
        // const countryCode = countryToCode(userRows[0].country);
        // if (countryCode && !['CD', 'US', ...].includes(countryCode)) {
        //     throw new Error("Les services de cryptomonnaie ne sont pas disponibles dans votre pays.");
        // }

        // 2. Générer toutes les adresses crypto nécessaires
        await getUserCryptoAddresses(userId);

        // 3. Mettre à jour le statut de l'utilisateur
        await connection.query('UPDATE users SET is_crypto_active = true WHERE id = $1', [userId]);
        
        await connection.query('COMMIT');

        // 4. Renvoyer l'objet utilisateur mis à jour
        const updatedUser = await getAuthenticatedUser();
        return { success: true, user: updatedUser || undefined };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'activating crypto wallet');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}


export async function createCryptoWallet(): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log('[Crypto Action] Creating new wallets for user...');
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
        success: true,
        data: {
            BTC: { address: `bc1${crypto.randomBytes(20).toString('hex')}` },
            ETH: { address: `0x${crypto.randomBytes(20).toString('hex')}` },
            USDT_ERC20: { address: `0x${crypto.randomBytes(20).toString('hex')}` },
            USDT_TRC20: { address: `T${crypto.randomBytes(20).toString('hex')}` },
            AFC: { address: `AFC${crypto.randomBytes(20).toString('hex')}` },
        }
    };
}

export async function getCryptoBalance(address: string, currency: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`[Crypto Action] Getting balance for ${currency} address: ${address}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
        success: true,
        data: {
            address,
            balance: (Math.random() * 1000).toFixed(4),
            currency,
        }
    };
}

export async function broadcastCryptoTransaction(signedTx: string, currency: string): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`[Crypto Action] Broadcasting ${currency} transaction: ${signedTx}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
     if (!signedTx.startsWith('signed_')) {
        return { success: false, error: 'Transaction invalide ou mal signée.' };
    }
    return {
        success: true,
        data: {
            txId: `tx_broadcast_${currency}_${Date.now()}`,
            status: 'broadcasted'
        }
    };
}

    