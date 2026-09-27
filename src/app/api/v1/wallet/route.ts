import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCryptoBalances } from '@/lib/actions/crypto.actions';
import { getCardsForUser } from '@/lib/actions/card.actions';
import { countries } from '@/lib/countries';
import { countryToCode } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function parseBalances(value: any): Record<string, number> {
    if (!value) {
        return {};
    }

    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return {};
        }
    }

    if (typeof value === 'object') {
        return value;
    }

    return {};
}

function normalizeBalance(value: any): number {
    const number = Number(value || 0);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return Number(number.toFixed(8));
}

function getNationalCurrency(country: string | null | undefined) {
    if (!country) {
        return null;
    }

    const countryCode = countryToCode(country);

    if (!countryCode) {
        return null;
    }

    const countryInfo = countries.find(
        (item: any) => item.code === countryCode
    );

    if (!countryInfo) {
        return null;
    }

    if (!countryInfo.currency_code) {
        return null;
    }

    return {
        countryCode,
        code: countryInfo.currency_code,
        name: countryInfo.currency_name || null,
        symbol: countryInfo.currency_symbol || null,
    };
}

async function getWalletData(userId: number) {
    const { rows } = await db.query(
        `
        SELECT
            w.id,
            w.user_id,
            w.id_wallet,
            w.balances,
            w.is_group_wallet,
            w.last_updated
        FROM wallets w
        WHERE w.user_id = $1
        LIMIT 1
        `,
        [userId]
    );

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
}

async function getBitcoinAddress(userId: number) {
    const { rows } = await db.query(
        `
        SELECT
            address
        FROM user_crypto_addresses
        WHERE user_id = $1
          AND currency_code = 'BTC'
        ORDER BY id DESC
        LIMIT 1
        `,
        [userId]
    );

    if (rows.length === 0) {
        return null;
    }

    return rows[0].address || null;
}

export async function GET(request: NextRequest) {
    try {
        const userIdParam =
            request.nextUrl.searchParams.get('userId');

        if (!userIdParam) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'userId est requis.',
                },
                { status: 400 }
            );
        }

        const userId = Number(userIdParam);

        if (!Number.isInteger(userId) || userId <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'userId invalide.',
                },
                { status: 400 }
            );
        }

        const userResult = await db.query(
            `
            SELECT
                id,
                id_wallet,
                country
            FROM users
            WHERE id = $1
            LIMIT 1
            `,
            [userId]
        );

        if (userResult.rowCount === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Utilisateur CashPay introuvable.',
                },
                { status: 404 }
            );
        }

        const user = userResult.rows[0];

        const wallet = await getWalletData(user.id);

        if (!wallet) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Portefeuille utilisateur introuvable.',
                },
                { status: 404 }
            );
        }

        /*
         * Devises et soldes fiat.
         */
        const balances = parseBalances(wallet.balances);

        const nationalCurrency =
            getNationalCurrency(user.country);

        const fiatBalances: Record<string, number> = {};

        Object.entries(balances).forEach(
            ([currency, amount]) => {
                fiatBalances[currency.toUpperCase()] =
                    normalizeBalance(amount);
            }
        );

        if (nationalCurrency?.code) {
            const nationalCode =
                nationalCurrency.code.toUpperCase();

            if (!(nationalCode in fiatBalances)) {
                fiatBalances[nationalCode] = 0;
            }
        }

        for (const currency of ['CDF', 'USD', 'EUR']) {
            if (!(currency in fiatBalances)) {
                fiatBalances[currency] = 0;
            }
        }

        /*
         * Soldes crypto.
         */
        let cryptoBalances: any[] = [];

        try {
            cryptoBalances =
                await getCryptoBalances(user.id);
        } catch (error) {
            console.error(
                '[API V1 WALLET] crypto balance error:',
                error
            );
        }

        const normalizedCryptoBalances =
            Array.isArray(cryptoBalances)
                ? cryptoBalances.map((item: any) => ({
                      currency:
                          item.currency ||
                          item.currency_code ||
                          item.currencyCode ||
                          null,
                      balance: normalizeBalance(
                          item.balance ??
                              item.amount ??
                              0
                      ),
                  }))
                : [];

        /*
         * Adresse Bitcoin.
         */
        let bitcoinAddress: string | null = null;

        try {
            bitcoinAddress =
                await getBitcoinAddress(user.id);
        } catch (error) {
            console.error(
                '[API V1 WALLET] bitcoin address error:',
                error
            );
        }

        const bitcoinBalance =
            normalizedCryptoBalances.find(
                (item: any) =>
                    String(item.currency).toUpperCase() ===
                    'BTC'
            )?.balance ?? 0;

        /*
         * Cartes liées au Wallet.
         */
        let cards: any[] = [];

        try {
            cards = await getCardsForUser(
                user.id,
                ''
            );
        } catch (error) {
            console.error(
                '[API V1 WALLET] cards error:',
                error
            );
        }

        const normalizedCards = cards.map(
            (card: any) => ({
                id: String(card.id),
                brand:
                    String(card.brand || '')
                        .toUpperCase() || null,
                cardType:
                    card.card_type ||
                    card.cardType ||
                    null,
                currency:
                    String(card.currency || '')
                        .toUpperCase() || null,
                last4: card.last4 || null,
                status:
                    String(
                        card.status || 'inactive'
                    ).toLowerCase(),
                isPrimary:
                    Boolean(card.is_primary),
                cardProviderId:
                    card.card_provider_id || null,
            })
        );

        /*
         * Réponse minimale du Wallet / Balance.
         */
        return NextResponse.json({
            success: true,

            wallet: {
                id: wallet.id,
                userId: wallet.user_id,
                walletId: wallet.id_wallet,
                isGroupWallet:
                    Boolean(wallet.is_group_wallet),
                lastUpdated:
                    wallet.last_updated
                        ? new Date(
                              wallet.last_updated
                          ).toISOString()
                        : null,
            },

            nationalCurrency,

            balances: {
                fiat: fiatBalances,
                crypto: normalizedCryptoBalances,
            },

            bitcoin: {
                address: bitcoinAddress,
                balance: normalizeBalance(
                    bitcoinBalance
                ),
                available:
                    Boolean(bitcoinAddress),
            },

            cards: normalizedCards,
        });
    } catch (error) {
        console.error(
            '[API V1 WALLET GET]',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    'Impossible de récupérer le portefeuille.',
            },
            { status: 500 }
        );
    }
}
