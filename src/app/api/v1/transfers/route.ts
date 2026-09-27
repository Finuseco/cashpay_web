import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyUserPin } from '@/lib/actions/auth.actions';
import { createTransaction } from '@/lib/actions/transaction.actions';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import { prepareBitcoinTransfer } from '@/lib/actions/bitcoin-transfer.actions';
import { formatUser, countryToCode } from '@/lib/utils';
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
        const userId =
            Number(
                request.nextUrl.searchParams.get(
                    'userId'
                )
            );

        if (
            !Number.isInteger(userId) ||
            userId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Utilisateur invalide.',
                },
                { status: 400 }
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
        const body =
            await request.json();

        const userId =
            Number(body?.userId);

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
            !Number.isInteger(userId) ||
            userId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Utilisateur invalide.',
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

        if (currency === 'BTC') {
            if (!recipientAddress) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            'L’adresse Bitcoin destinataire est requise.',
                    },
                    { status: 400 }
                );
            }

            if (receiverWalletId) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            'Un portefeuille CashPay ne peut pas être utilisé comme destination Bitcoin.',
                    },
                    { status: 400 }
                );
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
                await prepareBitcoinTransfer({
                    userId,
                    recipientAddress,
                    amount,
                    pin,
                });

            return NextResponse.json(
                result,
                {
                    status:
                        result.success
                            ? 200
                            : 400,
                }
            );
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
