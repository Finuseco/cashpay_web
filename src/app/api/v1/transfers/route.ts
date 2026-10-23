import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
    verifyUserPin,
} from '@/lib/actions/auth.actions';
import {
    getAuthenticatedUser,
} from '@/lib/actions/user.actions';
import {
    createTransaction,
    sendTransactionNotifications,
} from '@/lib/actions/transaction.actions';
import { getUserFromDb } from '@/lib/actions/helpers';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import { prepareBitcoinTransfer } from '@/lib/actions/bitcoin-transfer.actions';
import { formatUser, countryToCode, generateReferenceCode } from '@/lib/utils';
import { countries } from '@/lib/countries';
import type { User } from '@/lib/types';

export const dynamic = 'force-dynamic';

const INTERNATIONAL_CURRENCIES = ['USD', 'EUR'];

function parseBalances(value: any): Record<string, number> {
    if (!value) return {};

    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return {};
        }
    }

    return typeof value === 'object' ? value : {};
}

function getLocalCurrency(country: string | null | undefined) {
    if (!country) return null;

    const code = countryToCode(country);

    if (!code) return null;

    const countryInfo = countries.find(
        item => item.code === code
    );

    if (!countryInfo?.currency_code) return null;

    return {
        countryCode: countryInfo.code,
        code: countryInfo.currency_code,
        name: countryInfo.currency_name,
        symbol: countryInfo.currency_symbol,
    };
}

async function getUser(userId: number) {
    const result = await db.query(
        `
        SELECT *
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
    );

    return result.rowCount ? result.rows[0] : null;
}

async function getWallet(userId: number) {
    const result = await db.query(
        `
        SELECT
            id,
            user_id,
            id_wallet,
            balances
        FROM wallets
        WHERE user_id = $1
        LIMIT 1
        `,
        [userId]
    );

    return result.rowCount ? result.rows[0] : null;
}

function getCurrencyBalance(
    balances: Record<string, number>,
    currency: string
) {
    if (!Object.prototype.hasOwnProperty.call(balances, currency)) {
        return null;
    }

    const balance = Number(balances[currency]);

    return Number.isFinite(balance) ? balance : 0;
}

function validateCurrency(
    sender: any,
    receiver: any,
    currency: string
) {
    const senderCurrency = getLocalCurrency(sender.country);
    const receiverCurrency = getLocalCurrency(receiver.country);

    const isInternational =
        INTERNATIONAL_CURRENCIES.includes(currency);

    if (!isInternational) {
        if (!senderCurrency) {
            return {
                success: false,
                error:
                    'La devise nationale de l’expéditeur ne peut pas être déterminée.',
            };
        }

        if (!receiverCurrency) {
            return {
                success: false,
                error:
                    'La devise nationale du destinataire ne peut pas être déterminée.',
            };
        }

        if (
            senderCurrency.code !==
            receiverCurrency.code
        ) {
            return {
                success: false,
                error:
                    'Cette devise nationale ne peut pas être utilisée pour ce destinataire. Veuillez utiliser une devise internationale.',
            };
        }

        if (currency !== senderCurrency.code) {
            return {
                success: false,
                error:
                    'Cette devise ne correspond pas à la devise nationale de votre pays. Veuillez utiliser votre devise nationale ou une devise internationale.',
            };
        }
    }

    return {
        success: true,
        senderCurrency,
        isInternational,
    };
}

async function prepareCashTransfer(
    userId: number,
    receiverWalletId: string,
    amount: number,
    currency: string
) {
    if (!receiverWalletId) {
        return {
            success: false,
            error:
                'Le portefeuille destinataire est requis.',
            status: 400,
        };
    }

    const sender = await getUser(userId);

    if (!sender) {
        return {
            success: false,
            error:
                'Utilisateur expéditeur introuvable.',
            status: 404,
        };
    }

    const senderWallet =
        await getWallet(userId);

    if (!senderWallet) {
        return {
            success: false,
            error:
                'Portefeuille expéditeur introuvable.',
            status: 404,
        };
    }

    const receiverResult =
        await db.query(
            `
            SELECT *
            FROM users
            WHERE id_wallet = $1
            LIMIT 1
            `,
            [receiverWalletId]
        );

    if (receiverResult.rowCount === 0) {
        return {
            success: false,
            error:
                'Portefeuille destinataire introuvable.',
            status: 404,
        };
    }

    const receiver =
        receiverResult.rows[0];

    if (
        Number(receiver.id) === userId ||
        String(receiver.id_wallet) ===
            String(sender.id_wallet)
    ) {
        return {
            success: false,
            error:
                'Vous ne pouvez pas effectuer un transfert vers votre propre portefeuille.',
            status: 400,
        };
    }

    const currencyCheck =
        validateCurrency(
            sender,
            receiver,
            currency
        );

    if (!currencyCheck.success) {
        return {
            ...currencyCheck,
            status: 400,
        };
    }

    const balances =
        parseBalances(
            senderWallet.balances
        );

    const availableBalance =
        getCurrencyBalance(
            balances,
            currency
        );

    if (availableBalance === null) {
        return {
            success: false,
            error:
                `La devise ${currency} n'est pas disponible dans votre portefeuille.`,
            status: 400,
        };
    }

    const connection =
        await db.getConnection();

    try {
        const fee =
            Number(
                await calculateTransactionFee(
                    amount,
                    currency,
                    'TR',
                    sender.country,
                    connection
                )
            );

        const totalDebit =
            amount + fee;

        if (
            availableBalance <
            totalDebit
        ) {
            return {
                success: false,
                status: 400,
                error: 'Solde insuffisant',
                availableBalance,
                totalDebit,
                missingAmount:
                    totalDebit -
                    availableBalance,
            };
        }

        return {
            success: true,
            sender,
            receiver,
            senderCurrency:
                currencyCheck.senderCurrency,
            isInternational:
                currencyCheck.isInternational,
            fee,
            totalDebit,
        };
    } finally {
        connection.release();
    }
}

async function transferCashPay(
    prepared: any,
    userId: number,
    amount: number,
    currency: string,
    pin: string
) {
    const pinResult =
        await verifyUserPin(
            userId,
            pin
        );

    if (!pinResult.success) {
        return {
            success: false,
            error:
                pinResult.error ||
                'Code PIN incorrect.',
            status: 401,
        };
    }

    const sender: User =
        formatUser(
            prepared.sender
        );

    const transactionResult =
        await createTransaction({
            user: sender,
            typeCode: 'TR',
            amount,
            currency,
            description:
                'Transfert CashPay',
            metadata: {
                source: 'onchat',
                sender_user_id:
                    userId,
                sender_wallet_id:
                    prepared.sender.id_wallet,
                receiver_user_id:
                    prepared.receiver.id,
                receiver_wallet_id:
                    prepared.receiver.id_wallet,
                currency_type:
                    prepared.isInternational
                        ? 'international'
                        : 'national',
            },
            receiver_id:
                Number(
                    prepared.receiver.id
                ),
            receiver_wallet_id:
                prepared.receiver.id_wallet,
            pin,
        });

    if (!transactionResult.success) {
        return {
            ...transactionResult,
            status: 400,
        };
    }

    const currencyInfo =
        prepared.isInternational
            ? {
                  code: currency,
                  name:
                      currency === 'USD'
                          ? 'US Dollar'
                          : 'Euro',
                  symbol:
                      currency === 'USD'
                          ? '$'
                          : '€',
                  type: 'international',
              }
            : {
                  code:
                      prepared.senderCurrency
                          .code,
                  name:
                      prepared.senderCurrency
                          .name,
                  symbol:
                      prepared.senderCurrency
                          .symbol,
                  type: 'national',
                  countryCode:
                      prepared.senderCurrency
                          .countryCode,
              };

    return {
        success: true,
        status: 201,
        transaction: {
            id:
                transactionResult.transactionId,
            reference:
                transactionResult.reference,
            amount,
            currency:
                currencyInfo,
            senderWalletId:
                prepared.sender.id_wallet,
            receiverWalletId:
                prepared.receiver.id_wallet,
            fee:
                transactionResult.fee,
            senderNewBalance:
                transactionResult.senderNewBalance,
            receiverNewBalance:
                transactionResult.receiverNewBalance,
        },
    };
}

export async function GET(
    request: NextRequest
) {
    try {
        const authenticatedUser =
            await getAuthenticatedUser();

        if (!authenticatedUser) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Authentification requise.',
                },
                { status: 401 }
            );
        }

        const userId =
            Number(
                authenticatedUser.id
            );

        if (
            !Number.isInteger(userId) ||
            userId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Utilisateur authentifié invalide.',
                },
                { status: 401 }
            );
        }

        const user =
            await getUser(userId);

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Utilisateur introuvable.',
                },
                { status: 404 }
            );
        }

        const wallet =
            await getWallet(userId);

        if (!wallet) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Portefeuille introuvable.',
                },
                { status: 404 }
            );
        }

        const balances =
            parseBalances(
                wallet.balances
            );

        const localCurrency =
            getLocalCurrency(
                user.country
            );

        const currencies = [];

        for (
            const code of
            INTERNATIONAL_CURRENCIES
        ) {
            currencies.push({
                code,
                name:
                    code === 'USD'
                        ? 'US Dollar'
                        : 'Euro',
                symbol:
                    code === 'USD'
                        ? '$'
                        : '€',
                type:
                    'international',
                balance:
                    getCurrencyBalance(
                        balances,
                        code
                    ) ?? 0,
            });
        }

        if (
            localCurrency &&
            !INTERNATIONAL_CURRENCIES.includes(
                localCurrency.code
            )
        ) {
            currencies.unshift({
                code:
                    localCurrency.code,
                name:
                    localCurrency.name,
                symbol:
                    localCurrency.symbol,
                type:
                    'national',
                balance:
                    getCurrencyBalance(
                        balances,
                        localCurrency.code
                    ) ?? 0,
            });
        }

        return NextResponse.json({
            success: true,
            country: {
                code:
                    localCurrency
                        ?.countryCode ||
                    null,
            },
            localCurrency:
                localCurrency
                    ? {
                          code:
                              localCurrency.code,
                          name:
                              localCurrency.name,
                          symbol:
                              localCurrency.symbol,
                      }
                    : null,
            currencies,
        });
    } catch (error: any) {
        console.error(
            '[TRANSFERS]',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    'Une erreur est survenue.',
            },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest
) {
    try {
        const authenticatedUser =
            await getAuthenticatedUser();

        if (!authenticatedUser) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Authentification requise.',
                },
                { status: 401 }
            );
        }

        const userId =
            Number(
                authenticatedUser.id
            );

        if (
            !Number.isInteger(userId) ||
            userId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Utilisateur authentifié invalide.',
                },
                { status: 401 }
            );
        }

        const body =
            await request.json();

        const amount =
            Number(body?.amount);

        const currency =
            typeof body?.currency ===
            'string'
                ? body.currency
                      .trim()
                      .toUpperCase()
                : '';

        const pin =
            typeof body?.pin ===
            'string'
                ? body.pin.trim()
                : '';

        const receiverWalletId =
            typeof body?.receiverWalletId ===
            'string'
                ? body.receiverWalletId.trim()
                : '';

        const recipientAddress =
            typeof body?.recipientAddress ===
            'string'
                ? body.recipientAddress.trim()
                : '';

        const preview =
            body?.preview === true;

        if (
            currency === 'USDT' &&
            !/^\d+(?:\.\d{1,6})?$/.test(String(body?.amount).trim())
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Le montant USDT doit avoir au maximum 6 décimales.'
                },
                { status: 400 }
            );
        }

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Le montant doit être supérieur à zéro.',
                },
                { status: 400 }
            );
        }

        if (!currency) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'La devise est requise.',
                },
                { status: 400 }
            );
        }


        // Les transferts crypto n'ont pas de mode "aperçu" : sans ce garde-fou,
        // une requête avec preview=true exécuterait un VRAI transfert.
        if (preview && (currency === 'USDT' || currency === 'BTC')) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'L’aperçu n’est pas disponible pour les transferts crypto : envoyez la requête sans "preview".'
                },
                { status: 400 }
            );
        }

        // USDT_TRC20_INTERNAL_TRANSFER
        if (currency === 'USDT') {
            if (!recipientAddress || !pin) {
                return NextResponse.json(
                    { success: false, error: 'Adresse TRON et code PIN requis.' },
                    { status: 400 }
                );
            }

            const { validateTronAddress } = await import('@/services/tron');
            if (!validateTronAddress(recipientAddress)) {
                return NextResponse.json(
                    { success: false, error: 'Adresse TRON invalide.' },
                    { status: 400 }
                );
            }

            const ownerResult = await db.query(
                `SELECT u.id, u.id_wallet
                 FROM user_crypto_addresses a
                 JOIN users u ON u.id = a.user_id
                 WHERE a.currency_code = 'USDT_TRC20'
                   AND a.address = $1
                 LIMIT 1`,
                [recipientAddress]
            );

            if (ownerResult.rows.length === 0) {
                // Adresse hors CashPay : retrait réel sur la blockchain TRON.
                // Même schéma de réponse que le transfert BTC externe.
                const { prepareUsdtTransfer } = await import(
                    '@/lib/actions/usdt-transfer.actions'
                );

                const result = await prepareUsdtTransfer({
                    userId,
                    recipientAddress,
                    amount,
                    pin,
                });

                return NextResponse.json(result, {
                    status: result.success
                        ? 200
                        : (result as { status?: string }).status === 'pending'
                            ? 202
                            : 400,
                });
            }

            const pinResult = await verifyUserPin(userId, pin);
            if (!pinResult.success) {
                return NextResponse.json(
                    { success: false, error: pinResult.error || 'Code PIN incorrect.' },
                    { status: 400 }
                );
            }

            const senderResult = await db.query(
                `SELECT id, id_wallet, country
                 FROM users
                 WHERE id = $1::integer
                 LIMIT 1`,
                [userId]
            );

            if (senderResult.rows.length === 0) {
                return NextResponse.json(
                    { success: false, error: 'Compte expéditeur introuvable.' },
                    { status: 404 }
                );
            }

            const sender = senderResult.rows[0];
            const receiver = ownerResult.rows[0];

            if (Number(sender.id) === Number(receiver.id)) {
                return NextResponse.json(
                    { success: false, error: 'Vous ne pouvez pas vous envoyer des USDT à vous-même.' },
                    { status: 400 }
                );
            }

            const client = await db.getConnection();
            let transactionStarted = false;

            try {
                await client.query('BEGIN');
                transactionStarted = true;

                await client.query(
                    `INSERT INTO user_crypto_balances
                       (user_id, currency_code, balance)
                     VALUES ($1, 'USDT_TRC20', 0), ($2, 'USDT_TRC20', 0)
                     ON CONFLICT (user_id, currency_code) DO NOTHING`,
                    [sender.id, receiver.id]
                );

                const balanceResult = await client.query(
                    `SELECT user_id, balance
                     FROM user_crypto_balances
                     WHERE currency_code = 'USDT_TRC20'
                       AND user_id = ANY($1::integer[])
                     ORDER BY user_id
                     FOR UPDATE`,
                    [[Number(sender.id), Number(receiver.id)]]
                );

                if (balanceResult.rows.length !== 2) {
                    throw new Error('Impossible de verrouiller les deux soldes USDT.');
                }

                const balances = new Map(
                    balanceResult.rows.map((row: { user_id: number; balance: string | number }) =>
                        [Number(row.user_id), Number(row.balance)]
                    )
                );

                const senderBalance = balances.get(Number(sender.id));
                if (senderBalance === undefined || !Number.isFinite(senderBalance)) {
                    throw new Error('Solde USDT invalide.');
                }

                const configuredFee = await calculateTransactionFee(
                    amount, 'USDT', 'WD_CRYPTO_MONEY', sender.country, client
                );
                const feeAmount = Number(configuredFee);

                if (!Number.isFinite(feeAmount) || feeAmount < 0) {
                    throw new Error('Configuration des frais USDT invalide.');
                }

                const totalDebit = amount + feeAmount;
                if (senderBalance < totalDebit) {
                    throw new Error('Solde USDT insuffisant (montant + frais).');
                }

                const debit = await client.query(
                    `UPDATE user_crypto_balances
                     SET balance = balance - $1
                     WHERE user_id = $2
                       AND currency_code = 'USDT_TRC20'
                       AND balance >= $1
                     RETURNING balance`,
                    [totalDebit, sender.id]
                );

                if (debit.rowCount !== 1) {
                    throw new Error('Débit USDT impossible : solde insuffisant.');
                }

                const credit = await client.query(
                    `UPDATE user_crypto_balances
                     SET balance = balance + $1
                     WHERE user_id = $2
                       AND currency_code = 'USDT_TRC20'
                     RETURNING balance`,
                    [amount, receiver.id]
                );

                if (credit.rowCount !== 1) {
                    throw new Error('Crédit USDT du destinataire impossible.');
                }

                const referenceCode = generateReferenceCode('WD_CRYPTO_MONEY');

                await client.query(
                    `INSERT INTO transactions (
                       reference_code, type_code, status, amount, currency, fee,
                       description, sender_id, receiver_id, sender_wallet_id,
                       receiver_wallet_id, metadata, btc_tx_hash
                     ) VALUES (
                       $1, 'WD_CRYPTO_MONEY', 'Completed', $2, 'USDT', $3,
                       'Transfert USDT interne CashPay', $4, $5, $6, $7, $8::jsonb, NULL
                     )`,
                    [
                        referenceCode, amount, feeAmount, sender.id, receiver.id,
                        sender.id_wallet, receiver.id_wallet,
                        JSON.stringify({
                            source: 'internal_cashpay',
                            currency: 'USDT',
                            network: 'TRC20',
                            feeCurrency: 'USDT',
                            feeTypeCode: 'WD_CRYPTO_MONEY'
                        })
                    ]
                );

                await client.query('COMMIT');
                transactionStarted = false;

                return NextResponse.json({
                    success: true,
                    status: 'Completed',
                    message: 'Transfert USDT interne effectué avec succès.',
                    referenceCode,
                    currency: 'USDT',
                    amount,
                    fee: feeAmount,
                    totalDebited: totalDebit,
                    receiverWalletId: receiver.id_wallet
                });
            } catch (error) {
                if (transactionStarted) {
                    await client.query('ROLLBACK').catch(() => undefined);
                }

                const message = error instanceof Error
                    ? error.message
                    : 'Erreur lors du transfert USDT interne.';

                console.error('[USDT interne]', error);

                return NextResponse.json(
                    { success: false, error: message },
                    { status: message.includes('insuffisant') ? 400 : 500 }
                );
            } finally {
                client.release();
            }
        }

        if (currency === 'BTC') {
            if (!recipientAddress) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'L’adresse Bitcoin du destinataire est requise.',
                    },
                    { status: 400 }
                );
            }

            if (!pin) {
                return NextResponse.json(
                    { success: false, error: 'Le code PIN est requis.' },
                    { status: 400 }
                );
            }

            const addressOwnerResult = await db.query(
                `SELECT u.id, u.id_wallet
                 FROM user_crypto_addresses a
                 JOIN users u ON u.id = a.user_id
                 WHERE a.currency_code = 'BTC'
                   AND a.address = $1
                 LIMIT 1`,
                [recipientAddress]
            );

            if (addressOwnerResult.rows.length === 0) {
                const result = await prepareBitcoinTransfer({
                    userId,
                    recipientAddress,
                    amount,
                    pin,
                });
                return NextResponse.json(result, {
                    status: result.success
                        ? 200
                        : result.status === 'pending'
                            ? 202
                            : 400,
                });
            }

            // Vérification du PIN pour le transfert interne CashPay.
            const pinResult = await verifyUserPin(userId, pin);

            if (!pinResult.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error: pinResult.error || 'Code PIN incorrect.',
                    },
                    { status: 400 }
                );
            }

            const senderResult = await db.query(
                `SELECT id, id_wallet, country
                 FROM users
                 WHERE id = $1::integer
                 LIMIT 1`,
                [userId]
            );

            if (senderResult.rows.length === 0) {
                return NextResponse.json(
                    { success: false, error: 'Compte expéditeur introuvable.' },
                    { status: 404 }
                );
            }

            const sender = senderResult.rows[0];
            const receiver = addressOwnerResult.rows[0];

            if (Number(sender.id) === Number(receiver.id)) {
                return NextResponse.json(
                    { success: false, error: 'Vous ne pouvez pas vous envoyer des BTC à vous-même.' },
                    { status: 400 }
                );
            }

            const client = await db.getConnection();
            let transactionStarted = false;

            try {
                await client.query('BEGIN');
                transactionStarted = true;

                // Crée les lignes de solde manquantes sans écraser les soldes existants.
                await client.query(
                    `INSERT INTO user_crypto_balances
                        (user_id, currency_code, balance)
                     VALUES ($1, 'BTC', 0), ($2, 'BTC', 0)
                     ON CONFLICT (user_id, currency_code) DO NOTHING`,
                    [sender.id, receiver.id]
                );

                // Verrouillage dans l'ordre des identifiants pour limiter les deadlocks.
                const balanceResult = await client.query(
                    `SELECT user_id, balance
                     FROM user_crypto_balances
                     WHERE currency_code = 'BTC'
                       AND user_id = ANY($1::integer[])
                     ORDER BY user_id
                     FOR UPDATE`,
                    [[Number(sender.id), Number(receiver.id)]]
                );

                if (balanceResult.rows.length !== 2) {
                    throw new Error('Impossible de verrouiller les deux soldes BTC.');
                }

                const balances = new Map(
                    balanceResult.rows.map((row: { user_id: number; balance: string | number }) => [
                        Number(row.user_id),
                        Number(row.balance),
                    ])
                );

                const senderBalance = balances.get(Number(sender.id));
                const receiverBalance = balances.get(Number(receiver.id));

                if (
                    senderBalance === undefined ||
                    receiverBalance === undefined ||
                    !Number.isFinite(senderBalance) ||
                    !Number.isFinite(receiverBalance)
                ) {
                    throw new Error('Soldes BTC invalides.');
                }

                // Utilise la règle de frais déjà configurée pour WD_CRYPTO_MONEY.
                const configuredFee = await calculateTransactionFee(
                    amount,
                    'BTC',
                    'WD_CRYPTO_MONEY',
                    sender.country,
                    client
                );

                const feeAmount = Number(configuredFee);

                if (!Number.isFinite(feeAmount) || feeAmount < 0) {
                    throw new Error('Configuration des frais BTC invalide.');
                }

                const totalDebit = amount + feeAmount;

                if (senderBalance < totalDebit) {
                    throw new Error('Solde BTC insuffisant (montant + frais).');
                }

                const debitResult = await client.query(
                    `UPDATE user_crypto_balances
                     SET balance = balance - $1
                     WHERE user_id = $2
                       AND currency_code = 'BTC'
                       AND balance >= $1
                     RETURNING balance`,
                    [totalDebit, sender.id]
                );

                if (debitResult.rowCount !== 1) {
                    throw new Error('Débit BTC impossible : solde insuffisant.');
                }

                const creditResult = await client.query(
                    `UPDATE user_crypto_balances
                     SET balance = balance + $1
                     WHERE user_id = $2
                       AND currency_code = 'BTC'
                     RETURNING balance`,
                    [amount, receiver.id]
                );

                if (creditResult.rowCount !== 1) {
                    throw new Error('Crédit BTC du destinataire impossible.');
                }

                const referenceCode = generateReferenceCode(
                    'WD_CRYPTO_MONEY'
                );

                await client.query(
                    `INSERT INTO transactions (
                        reference_code,
                        type_code,
                        status,
                        amount,
                        currency,
                        fee,
                        description,
                        sender_id,
                        receiver_id,
                        sender_wallet_id,
                        receiver_wallet_id,
                        metadata,
                        btc_tx_hash
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7,
                        $8, $9, $10, $11, $12::jsonb, NULL
                    )`,
                    [
                        referenceCode,
                        'WD_CRYPTO_MONEY',
                        'Completed',
                        amount,
                        'BTC',
                        feeAmount,
                        'Transfert BTC interne CashPay',
                        sender.id,
                        receiver.id,
                        sender.id_wallet,
                        receiver.id_wallet,
                        JSON.stringify({
                            source: 'internal_cashpay',
                            currency: 'BTC',
                            feeCurrency: 'BTC',
                            feeTypeCode: 'WD_CRYPTO_MONEY',
                        }),
                    ]
                );

                await client.query('COMMIT');
                transactionStarted = false;

                // Les notifications sont envoyées après validation du transfert.
                try {
                    const senderUser = await getUserFromDb(Number(sender.id));
                    const receiverUser = await getUserFromDb(Number(receiver.id));

                    if (senderUser) {
                        await sendTransactionNotifications(
                            senderUser,
                            {
                                description: 'Transfert BTC interne CashPay',
                                amount,
                                currency: 'BTC',
                                fee: feeAmount,
                                reference: referenceCode,
                                newBalance: 0,
                                typeCode: 'WD_CRYPTO_MONEY',
                            },
                            receiverUser ? {
                                id: Number(receiverUser.id),
                                phone: receiverUser.phone,
                                email: receiverUser.email,
                                name: receiverUser.first_name || receiverUser.full_name,
                                newBalance: 0,
                                walletId: receiverUser.id_wallet,
                            } : undefined
                        );
                    }
                } catch (notificationError) {
                    console.error('[BTC interne] Échec des notifications :', notificationError);
                }



                return NextResponse.json({
                    success: true,
                    status: 'Completed',
                    message: 'Transfert BTC interne effectué avec succès.',
                    referenceCode,
                    currency: 'BTC',
                    amount,
                    fee: feeAmount,
                    totalDebited: totalDebit,
                    receiverWalletId: receiver.id_wallet,
                });
            } catch (error) {
                if (transactionStarted) {
                    try {
                        await client.query('ROLLBACK');
                    } catch (rollbackError) {
                        console.error('[BTC interne] Échec du rollback :', rollbackError);
                    }
                }

                const message = error instanceof Error
                    ? error.message
                    : 'Erreur lors du transfert BTC interne.';

                console.error('[BTC interne]', error);

                const status = message.includes('Solde BTC insuffisant') ||
                    message.includes('Débit BTC impossible')
                    ? 400
                    : 500;

                return NextResponse.json(
                    { success: false, error: message },
                    { status }
                );
            } finally {
                client.release();
            }
        }
        if (recipientAddress) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Une adresse Bitcoin ne peut être utilisée que pour un transfert BTC.',
                },
                { status: 400 }
            );
        }

        const prepared =
            await prepareCashTransfer(
                userId,
                receiverWalletId,
                amount,
                currency
            );

        if (!prepared.success) {
            if (
                prepared.error ===
                'Solde insuffisant'
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            'Solde insuffisant',
                        message:
                            `Solde disponible : ${Number(prepared.availableBalance).toFixed(2)} ${currency}\nTotal nécessaire : ${Number(prepared.totalDebit).toFixed(2)} ${currency}\nManquant : ${Number(prepared.missingAmount).toFixed(2)} ${currency}`,
                    },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                prepared,
                {
                    status:
                        prepared.status ||
                        400,
                }
            );
        }

             if (preview) {
            return NextResponse.json({
                success: true,
                message:
                    'Confirmer votre transfert :',
                amount,
                currency,
                fee:
                    prepared.fee,
                totalDebit:
                    prepared.totalDebit,
            });
        }

        if (!pin) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Le code PIN est requis.',
                },
                { status: 400 }
            );
        }

        const result =
            await transferCashPay(
                prepared,
                userId,
                amount,
                currency,
                pin
            );

        return NextResponse.json(
            result,
            {
                status:
                    result.status ||
                    (result.success
                        ? 201
                        : 400),
            }
        );
    } catch (error: any) {
        console.error(
            '[TRANSFERS]',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    error?.message ||
                    'Une erreur est survenue.',
            },
            { status: 500 }
        );
    }
}
