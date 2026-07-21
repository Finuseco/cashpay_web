
'use server';

import { db } from '@/lib/db';
import { handleDbError, saveBase64Image, getUserFromDb } from './helpers';
import { generateReferenceCode, type TransactionTypeCode, formatUser, countryToCode } from '../utils';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { sendWhatsAppTextMessage } from '@/services/whatsapp';
import type { User, Transaction, CartItem } from '@/lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { PoolClient } from 'pg';
import { calculateTransactionFee } from './wallet.actions';
import { createNotification } from './notification.actions';
import { updateReferralStatusOnDeposit } from './referral.actions';
import { queryTransactionStatus } from '@/services/mpesa';
import fs from 'fs/promises';
import path from 'path';

const PAYOUT_SUSPENSE_WALLET_ID = 'CD0100000003';

/**
 * Masque un identifiant de portefeuille au format souverain : CC AA **** XXXX
 */
function maskWalletId(walletId?: string | null): string {
    if (!walletId || walletId.length < 12) return '********';
    const country = walletId.substring(0, 2);
    const agency = walletId.substring(2, 4);
    const last4 = walletId.slice(-4);
    return `${country}${agency}****${last4}`;
}

/**
 * Envoie les notifications de transaction. 
 * Inclut systématiquement TOUS les soldes disponibles pour le sender et le receiver.
 */
export async function sendTransactionNotifications(
    user: User, 
    details: { description: string; amount: number; currency: string; fee: number; reference: string; newBalance: number; typeCode: string },
    receiver?: { id: number; phone?: string | null, email?: string | null, name?: string, newBalance?: number, walletId?: string }
) {
    try {
        const { description, amount, currency, fee, reference, typeCode } = details;
        const maskedSenderWallet = maskWalletId(user.id_wallet);
        
        // RÉCUPÉRATION SYSTÉMATIQUE DE TOUS LES SOLDES
        const { rows: senderWalletRows } = await db.query('SELECT balances FROM wallets WHERE user_id = $1', [user.id]);
        const senderBalances = typeof senderWalletRows[0]?.balances === 'string' ? JSON.parse(senderWalletRows[0].balances) : (senderWalletRows[0]?.balances || {});
        
        const senderBalanceString = Object.entries(senderBalances)
            .map(([cur, amt]) => `${Number(amt).toFixed(2)} ${cur}`)
            .join(', ');

        const isHsm = typeCode === 'HSM_LOCK' || typeCode === 'B2B_HSM_ISSUE' || typeCode === 'RW';
        const finalDescription = isHsm ? "Mouvement de fonds sur support physique" : description;

        // CONSTRUCTION DU SMS AVEC TOUS LES SOLDES
        const senderSms = `CashPay: ${finalDescription}. Montant: ${amount} ${currency}. Frais: ${fee.toFixed(2)} ${currency}. Réf: ${reference}. Portefeuille: ${maskedSenderWallet}.\nVos nouveaux soldes: ${senderBalanceString}.`;
        
        if (user.email) {
            await sendEmail(user.email, `Transaction CashPay : ${typeCode}`, 'receipt', {
                title: 'Confirmation de Transaction',
                greeting: `Bonjour ${user.first_name || user.full_name},`,
                message: `Transaction confirmée sur le compte ${maskedSenderWallet}. Vos nouveaux soldes sont : ${senderBalanceString}.`,
                amount: `${currency} ${amount.toFixed(2)}`,
                fee: `${currency} ${fee.toFixed(2)}`,
                total: `${currency} ${(amount + fee).toFixed(2)}`,
                reference,
                buttonText: 'Voir mes transactions',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/transactions`,
                signature: "L'équipe CashPay"
            });
        }

        const preferredChannels = user.notifications_channel || ['sms', 'whatsapp'];
        for (const channel of preferredChannels) {
            if (channel === 'whatsapp' && user.phone) await sendWhatsAppTextMessage(user.phone, senderSms);
            if (channel === 'sms' && user.phone) await sendSms(user.phone, senderSms);
        }

        // Notification récepteur incluant aussi ses soldes
        if (receiver && !['HSM_LOCK', 'B2B_HSM_ISSUE'].includes(typeCode)) {
             const { rows: receiverWalletRows } = await db.query('SELECT balances FROM wallets WHERE user_id = $1', [receiver.id]);
             const recBalances = typeof receiverWalletRows[0]?.balances === 'string' ? JSON.parse(receiverWalletRows[0].balances) : (receiverWalletRows[0]?.balances || {});
             const recBalanceString = Object.entries(recBalances)
                .map(([cur, amt]) => `${Number(amt).toFixed(2)} ${cur}`)
                .join(', ');

             const maskedReceiverWallet = maskWalletId(receiver.walletId);
             const receiverSms = `CashPay: Vous avez reçu ${amount} ${currency} de ${user.full_name}. Compte: ${maskedReceiverWallet}.\nVos nouveaux soldes: ${recBalanceString}.\nRéf: ${reference}.`;
             
             await createNotification(
                 receiver.id,
                 `Paiement Reçu: ${amount} ${currency}`,
                 `Reçu de ${user.full_name}. Vos nouveaux soldes: ${recBalanceString}.`,
                 'new_message',
                 { contactId: user.id }
             );

             if (receiver.email) {
                 await sendEmail(receiver.email, `Paiement Reçu sur ${maskedReceiverWallet}`, 'general', {
                    title: 'Paiement Reçu',
                    greeting: `Bonjour ${receiver.name},`,
                    message: `Vous avez reçu un paiement de <strong>${amount} ${currency}</strong> de la part de ${user.full_name}.<br/>Vos nouveaux soldes : <strong>${recBalanceString}</strong>.`,
                    buttonText: 'Voir la transaction',
                    buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/transactions`,
                    signature: "L'équipe CashPay"
                 });
             }
             if (receiver.phone) await sendSms(receiver.phone, receiverSms);
        }
    } catch (error) {
        console.error("Failed to send transaction notifications:", error);
    }
}

interface CreateTransactionArgs {
    user: User;
    typeCode: TransactionTypeCode;
    amount: number;
    currency: string;
    sourceCurrency?: string; // Optionnel : pour payer avec un autre portefeuille
    description: string;
    metadata: Record<string, any>;
    status?: 'Completed' | 'Pending' | 'Failed' | 'Reversed';
    facilitatorAgentId?: number;
    receiver_id?: number | null;
    receiver_wallet_id?: string | null;
    pin?: string;
    referenceCode?: string;
    connection?: PoolClient;
}

/**
 * Moteur de transaction souverain v2.3.
 * Supporte la conversion de devise en temps réel et l'application systématique des frais.
 */
export async function createTransaction(args: CreateTransactionArgs): Promise<{ success: boolean; error?: string; reference?: string, transactionId?: number, senderNewBalance?: number, receiverNewBalance?: number, fee?: number }> {
    const { user, typeCode, amount, currency, sourceCurrency, description, metadata, status = 'Completed', receiver_id, receiver_wallet_id: providedReceiverWalletId, referenceCode: providedReferenceCode } = args;

    const conn = args.connection || await db.getConnection();
    let reference_code = providedReferenceCode || generateReferenceCode(typeCode as any); 
    
    try {
        if (!args.connection) {
            await conn.query('BEGIN');
        }

        if (user.id === receiver_id && !['EXCHANGE', 'RW', 'DP_CRYPTO', 'DP_CARD', 'DP_PAYPAL'].includes(typeCode)) {
            throw new Error('Vous ne pouvez pas envoyer de l\'argent à vous-même.');
        }

        let transactionMetadata = { ...metadata };
        const isPayout = typeCode.startsWith('WD_') || typeCode === 'INTL_SEND';
        const isHsmLock = typeCode === 'HSM_LOCK' || typeCode === 'B2B_HSM_ISSUE';
        const isPayment = typeCode === 'PAYMENT' || typeCode === 'POS_SALE' || typeCode === 'SALE';

        const needsLock = status === 'Completed' || (status === 'Pending' && (isPayout || isHsmLock));
        const lockClause = needsLock ? 'FOR UPDATE' : '';
        
        // 1. Détermination de la devise de débit (Souveraine)
        const debitCurrency = sourceCurrency || currency;
        
        const { rows: senderWalletRows } = await conn.query(`SELECT balances FROM wallets WHERE user_id = $1::integer ${lockClause}`, [user.id]);
        if (senderWalletRows.length === 0) throw new Error("Portefeuille de l'utilisateur non trouvé.");
        
        const senderBalances = typeof senderWalletRows[0].balances === 'string' 
            ? JSON.parse(senderWalletRows[0].balances) 
            : (senderWalletRows[0].balances || {});

        const currentBalance = Number(senderBalances[debitCurrency] || 0);
        
        // 2. Calcul du montant à débiter (Conversion si nécessaire)
        let amountToDebit = Number(amount);
        let conversionRate = 1;

        if (debitCurrency !== currency) {
            const { rows: rateRows } = await conn.query(
                "SELECT rate FROM exchange_rates WHERE country_code = $1 AND from_currency = $2 AND to_currency = $3",
                [countryToCode(user.country) || 'GBL', currency, debitCurrency]
            );
            if (rateRows.length === 0) throw new Error(`Le taux de change ${currency}/${debitCurrency} n'est pas configuré pour votre zone.`);
            conversionRate = parseFloat(rateRows[0].rate);
            amountToDebit = amount * conversionRate;
            transactionMetadata.original_amount = amount;
            transactionMetadata.original_currency = currency;
            transactionMetadata.exchange_rate = conversionRate;
        }

        // 3. Calcul des Frais (Souverains)
        const isCreditTransaction = ['DP', 'WG', 'LP', 'RW', 'INTL_CLAIM', 'PUB_EARN', 'DP_CRYPTO', 'DP_CARD', 'DP_PAYPAL', 'GROUP_CONTRIBUTION', 'REF_REWARD'].includes(typeCode);
        const effectiveTypeCode = isPayment ? 'TR' : typeCode;

        let feeNum = 0;
        if (!isCreditTransaction && typeCode !== 'EXCHANGE' && !typeCode.startsWith('BUY_CARDS')) {
             feeNum = await calculateTransactionFee(amountToDebit, debitCurrency, effectiveTypeCode, user.country, conn);
        }

        const totalDebitAmount = isCreditTransaction ? 0 : amountToDebit + feeNum;

        // 4. Vérification de Solvabilité
        if (totalDebitAmount > 0 && currentBalance < totalDebitAmount) {
            throw new Error(`Solde insuffisant en ${debitCurrency}. Requis: ${totalDebitAmount.toFixed(2)} (incluant ${feeNum.toFixed(2)} de frais), disponible: ${currentBalance.toFixed(2)}.`);
        }

        // 5. Exécution du Débit
        if (status === 'Completed' || (status === 'Pending' && (isPayout || isHsmLock))) {
            if (isCreditTransaction) {
                senderBalances[debitCurrency] = currentBalance + amountToDebit;
            } else if (typeCode === 'EXCHANGE') {
                const { toCurrency, toAmount } = metadata;
                senderBalances[debitCurrency] = currentBalance - amountToDebit;
                senderBalances[toCurrency] = Number(senderBalances[toCurrency] || 0) + Number(toAmount);
            } else {
                senderBalances[debitCurrency] = currentBalance - totalDebitAmount;
            }
            await conn.query('UPDATE wallets SET balances = $1::jsonb WHERE user_id = $2::integer', [JSON.stringify(senderBalances), user.id]);
            
            if (isPayout) {
                const { rows: suspenseWalletRows } = await conn.query('SELECT balances FROM wallets WHERE id_wallet = $1::text FOR UPDATE', [PAYOUT_SUSPENSE_WALLET_ID]);
                if (suspenseWalletRows.length > 0) {
                    const suspenseBalances = typeof suspenseWalletRows[0].balances === 'string' ? JSON.parse(suspenseWalletRows[0].balances) : (suspenseWalletRows[0].balances || {});
                    suspenseBalances[debitCurrency] = Number(suspenseBalances[debitCurrency] || 0) + totalDebitAmount;
                    await conn.query('UPDATE wallets SET balances = $1::jsonb WHERE id_wallet = $2::text', [JSON.stringify(suspenseBalances), PAYOUT_SUSPENSE_WALLET_ID]);
                }
            }
        }
        const senderNewBalance = senderBalances[debitCurrency];

        // 6. Exécution du Crédit Destinataire (Si interne)
        let receiverIdToUse = receiver_id || (metadata.receiver_id ? Number(metadata.receiver_id) : null);
        let receiverWalletId = providedReceiverWalletId || metadata.receiver_wallet_id || null;
        let receiverInfo: any = undefined;
        let receiverNewBalance: number | undefined;

        const isInternalCredit = status === 'Completed' && ['TR', 'PAYMENT', 'WG', 'POS_SALE', 'SALE', 'TICKET_BUY', 'MKTG_FEE', 'GROUP_CONTRIBUTION', 'REF_REWARD'].includes(typeCode);

        if (isInternalCredit && (receiverIdToUse || receiverWalletId)) {
            let creditAmount = amount; // On crédite le montant original en devise originale
            
            if (isPayment) {
                 const vatAmount = metadata.vat_amount || 0;
                 creditAmount = amount - vatAmount;
                 transactionMetadata.agent_commission = vatAmount;
            }

            const { rows: recWalletRows } = await conn.query(
                receiverIdToUse 
                    ? 'SELECT balances FROM wallets WHERE user_id = $1::integer FOR UPDATE' 
                    : 'SELECT balances FROM wallets WHERE id_wallet = $1::text FOR UPDATE', 
                [receiverIdToUse || receiverWalletId]
            );

            if (recWalletRows.length > 0) {
                const recBalances = typeof recWalletRows[0].balances === 'string' ? JSON.parse(recWalletRows[0].balances) : (recWalletRows[0].balances || {});
                recBalances[currency] = Number(recBalances[currency] || 0) + Number(creditAmount);
                
                if (receiverIdToUse) {
                    await conn.query('UPDATE wallets SET balances = $1::jsonb WHERE user_id = $2::integer', [JSON.stringify(recBalances), receiverIdToUse]);
                } else {
                    await conn.query('UPDATE wallets SET balances = $1::jsonb WHERE id_wallet = $2::text', [JSON.stringify(recBalances), receiverWalletId]);
                }

                const { rows: receiverRows } = await conn.query('SELECT u.id, u.full_name, u.phone, u.email, u.id_wallet FROM users u WHERE ' + (receiverIdToUse ? 'u.id = $1::integer' : 'u.id_wallet = $1::text'), [receiverIdToUse || receiverWalletId]);
                if (receiverRows.length > 0) {
                    const rec = receiverRows[0];
                    receiverNewBalance = recBalances[currency];
                    receiverInfo = { id: rec.id, phone: rec.phone, email: rec.email, name: rec.full_name, newBalance: receiverNewBalance, walletId: rec.id_wallet };
                }
            }
        }
        
        const { rows: transactionResultRows } = await conn.query(
            `INSERT INTO transactions (
                reference_code, type_code, status, amount, currency, 
                fee, description, sender_id, receiver_id, 
                sender_wallet_id, receiver_wallet_id, metadata
            ) VALUES ($1::text, $2::text, $3::text, $4::numeric, $5::text, $6::numeric, $7::text, $8::integer, $9::integer, $10::text, $11::text, $12::jsonb) 
            RETURNING id`,
            [reference_code, typeCode, status, amountToDebit, debitCurrency, feeNum, description, user.id, receiverIdToUse || null, user.id_wallet, receiverWalletId || null, JSON.stringify(transactionMetadata)]
        );
        const transactionId = transactionResultRows[0].id;

        if (!args.connection) {
            await conn.query('COMMIT');
            if (status === 'Completed') {
                sendTransactionNotifications(user, { description, amount: amountToDebit, currency: debitCurrency, fee: feeNum, reference: reference_code, newBalance: senderNewBalance, typeCode }, receiverInfo).catch(console.error);
            }
        }
        
        return { success: true, reference: reference_code, transactionId, senderNewBalance, receiverNewBalance, fee: feeNum };

    } catch (error: any) {
        if (!args.connection) await conn.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        if (!args.connection && conn) conn.release();
    }
}

/**
 * Rembourse (Reverse) une transaction de retrait qui a échoué.
 */
export async function reverseTransaction(transactionId: number, reason: string): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: txRows } = await connection.query('SELECT * FROM transactions WHERE id = $1::integer FOR UPDATE', [transactionId]);
        if (txRows.length === 0) throw new Error("Transaction introuvable.");
        const tx = txRows[0];

        if (tx.status === 'Completed') throw new Error("Impossible de rembourser une transaction déjà finalisée.");
        if (tx.status === 'Reversed') throw new Error("Cette transaction a déjà été remboursée.");

        const refundAmount = Number(tx.amount) + Number(tx.fee || 0);
        const currency = tx.currency;

        await connection.query(
            `UPDATE wallets SET balances = jsonb_set(COALESCE(balances, '{}'::jsonb), '{${currency}}', (COALESCE((balances->>'${currency}')::numeric, 0) - $1::numeric)::text::jsonb) WHERE id_wallet = $2::text`,
            [refundAmount, PAYOUT_SUSPENSE_WALLET_ID]
        );

        await connection.query(
            `UPDATE wallets SET balances = jsonb_set(COALESCE(balances, '{}'::jsonb), '{${currency}}', (COALESCE((balances->>'${currency}')::numeric, 0) + $1::numeric)::text::jsonb) WHERE user_id = $2::integer`,
            [refundAmount, tx.sender_id]
        );

        await connection.query('UPDATE transactions SET status = $1::text, metadata = metadata || $2::jsonb WHERE id = $3::integer', 
            ['Reversed', JSON.stringify({ reversal_reason: reason, reversed_at: new Date() }), transactionId]);

        await connection.query('COMMIT');
        
        await createNotification(tx.sender_id, 'Remboursement effectué', `Votre transaction de ${tx.amount} ${tx.currency} a échoué et vous a été remboursée.`);

        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function getUserTransactions(userId: number, limit: number = 20, dateRange?: { from: Date, to: Date }): Promise<Transaction[]> {
    try {
        let query = `
            SELECT t.*, 
                   s.full_name as sender_name, s.profile_photo as sender_photo, 
                   r.full_name as receiver_name, r.profile_photo as receiver_photo
             FROM transactions t
             LEFT JOIN users s ON t.sender_id = s.id
             LEFT JOIN users r ON t.receiver_id = r.id
             WHERE (t.sender_id = $1::integer OR t.receiver_id = $1::integer) AND t.status IN ('Completed', 'Pending', 'Reversed')
        `;
        const params: (number | Date)[] = [userId];
        if (dateRange) {
            query += ` AND t.created_at BETWEEN $2::timestamp AND $3::timestamp`;
            params.push(dateRange.from, dateRange.to);
        }
        query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1}::integer`;
        params.push(limit);

        const { rows } = await db.query(query, params);
        return rows.map(row => {
            const isSender = row.sender_id === userId;
            const typeCode = row.type_code;
            
            const isHsmCreation = (typeCode === 'HSM_LOCK' || typeCode === 'B2B_HSM_ISSUE');
            const isHsmRecovery = row.metadata?.hsm_recovery === true;
            
            const isCreditType = ['DP', 'WG', 'LP', 'RW', 'INTL_CLAIM', 'PUB_EARN', 'DP_CRYPTO', 'DP_CARD', 'DP_PAYPAL', 'GROUP_CONTRIBUTION', 'REF_REWARD'].includes(typeCode);
            const isReceiver = row.receiver_id === userId || (row.receiver_wallet_id === row.id_wallet);
            
            let type: "sent" | "received" = (isCreditType || isReceiver) ? 'received' : 'sent';
            let description = row.description;

            if (isHsmCreation) {
                description = "Fonds sécurisés sur support physique";
            } else if (isHsmRecovery) {
                description = "Récupération de fonds via signature physique";
            } else if (type === 'received' && (typeCode === 'TR' || typeCode === 'PAYMENT')) {
                description = `Reçu de ${row.sender_name || 'un utilisateur'}`;
            }

            return {
                type, description,
                date: format(new Date(row.created_at), 'dd/MM/yyyy'),
                time: format(new Date(row.created_at), 'HH:mm'),
                amount: parseFloat(row.amount).toFixed(2),
                currency: row.currency,
                fee: parseFloat(row.fee || 0),
                reference: row.reference_code,
                metadata: { 
                    ...row.metadata, 
                    senderName: (isHsmCreation || isHsmRecovery) ? "Utilisateur CashPay" : row.sender_name, 
                    receiverName: (isHsmCreation || isHsmRecovery) ? "Utilisateur CashPay" : row.receiver_name, 
                    senderPhoto: (isHsmCreation || isHsmRecovery) ? null : row.sender_photo, 
                    receiverPhoto: (isHsmCreation || isHsmRecovery) ? null : row.receiver_photo,
                    typeCode: row.type_code, status: row.status
                },
            };
        });
    } catch (error) {
        return [];
    }
}

export async function checkMpesaTransactionStatus(reference: string): Promise<{ success: boolean; message: string }> {
    try {
        const result = await queryTransactionStatus(reference);
        return { success: result.success, message: result.message };
    } catch (error) {
        console.error('[Action] M-Pesa status check failed:', error);
        return { success: false, message: "Échec de la vérification du statut." };
    }
}

let cachedLogoBase64: string | null = null;
export async function getReceiptLogoBase64(): Promise<string | null> {
    if (cachedLogoBase64) return cachedLogoBase64;
    try {
        const filePath = path.join(process.cwd(), 'public', 'logos', 'logo.png');
        const fileBuffer = await fs.readFile(filePath);
        cachedLogoBase64 = `data:image/png;base64,${fileBuffer.toString('base64')}`;
        return cachedLogoBase64;
    } catch (error) {
        return null;
    }
}
