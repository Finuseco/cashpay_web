import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { verifyUserPin } from '@/lib/actions/auth.actions';
import { createNotification } from '@/lib/actions/notification.actions';
import { countries } from '@/lib/countries';
import { countryToCode } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FiatCurrency = string;
type Direction = 'BUY_BTC' | 'SELL_BTC';

async function getBitcoinPrice(
  currency: FiatCurrency,
  countryCode: string,
): Promise<number> {
  const { rows } = await db.query(
    `SELECT from_currency, to_currency, rate
       FROM exchange_rates
      WHERE country_code = $1
        AND (
          (from_currency = 'BTC' AND to_currency = $2)
          OR (from_currency = $2 AND to_currency = 'BTC')
        )
      ORDER BY created_at DESC
      LIMIT 1`,
    [countryCode, currency],
  );

  if (!rows.length) {
    throw new Error(
      `Taux BTC/${currency} absent pour le pays ${countryCode}. Aucun échange effectué.`,
    );
  }

  const rate = Number(rows[0].rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Le taux BTC enregistré dans CashPay All est invalide.');
  }

  return rows[0].from_currency === 'BTC' ? rate : 1 / rate;
}
export async function POST(request: NextRequest) {
  let connection: Awaited<ReturnType<typeof db.getConnection>> | undefined;
  let transactionStarted = false;

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Session invalide. Veuillez vous reconnecter.' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const direction = body?.direction as Direction;

    const countryCode = countryToCode(user.country);
    if (!countryCode) {
      return NextResponse.json(
        { success: false, error: 'Pays du compte introuvable ou non reconnu.' },
        { status: 400 },
      );
    }

    const localCurrency = countries.find(
      (country) => country.code === countryCode,
    )?.currency_code;

    if (!localCurrency) {
      return NextResponse.json(
        { success: false, error: 'Devise locale introuvable pour ce pays.' },
        { status: 400 },
      );
    }

    const requestedCurrency = String(body?.currency ?? '').trim().toUpperCase();
    const currency: FiatCurrency = requestedCurrency || localCurrency;
    const amount = Number(body?.amount);
    const pin = String(body?.pin ?? '');

    if (!['BUY_BTC', 'SELL_BTC'].includes(direction)) {
      return NextResponse.json(
        { success: false, error: 'Direction invalide. Utilisez BUY_BTC ou SELL_BTC.' },
        { status: 400 },
      );
    }

    if (
      !/^[A-Z]{3}$/.test(currency) ||
      ![localCurrency, 'USD', 'EUR'].includes(currency)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Devise non autorisée. Devise locale du compte : ${localCurrency}.`,
        },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      return NextResponse.json(
        { success: false, error: 'Montant invalide.' },
        { status: 400 },
      );
    }

    if (!/^\d{4,8}$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: 'PIN invalide.' },
        { status: 400 },
      );
    }

    const pinResult = await verifyUserPin(Number(user.id), pin);

    if (!pinResult.success) {
      return NextResponse.json(
        { success: false, error: pinResult.error || 'PIN incorrect.' },
        { status: 401 },
      );
    }

    // BUY_BTC: amount is the fiat amount to debit.
    // SELL_BTC: amount is the BTC amount to debit.
    const marketPrice = await getBitcoinPrice(currency, countryCode);
    const fiatAmount =
      direction === 'BUY_BTC' ? Number(amount.toFixed(2)) :
      Number((amount * marketPrice).toFixed(2));

    const btcAmount =
      direction === 'BUY_BTC'
        ? Number((amount / marketPrice).toFixed(8))
        : Number(amount.toFixed(8));

    if (
      !Number.isFinite(fiatAmount) ||
      !Number.isFinite(btcAmount) ||
      fiatAmount <= 0 ||
      btcAmount <= 0
    ) {
      return NextResponse.json(
        { success: false, error: 'Montant calculé invalide.' },
        { status: 400 },
      );
    }

    const reference = `CRX-${Date.now()}-${randomUUID().slice(0, 8)}`;

    connection = await db.getConnection();
    await connection.query('BEGIN');
    transactionStarted = true;

    // Lock the user's fiat wallet before changing any balance.
    const { rows: walletRows } = await connection.query(
      'SELECT balances FROM wallets WHERE user_id = $1 FOR UPDATE',
      [user.id],
    );

    if (!walletRows.length) {
      throw new Error('Portefeuille fiat introuvable.');
    }

    const rawBalances = walletRows[0].balances;
    const balances =
      typeof rawBalances === 'string'
        ? JSON.parse(rawBalances || '{}')
        : (rawBalances || {});

    const fiatBalance = Number(balances[currency] ?? 0);

    // Ensure the BTC balance row exists, then lock it.
    await connection.query(
      `INSERT INTO user_crypto_balances (user_id, currency_code, balance)
       VALUES ($1, 'BTC', 0)
       ON CONFLICT (user_id, currency_code) DO NOTHING`,
      [user.id],
    );

    const { rows: cryptoRows } = await connection.query(
      `SELECT balance
       FROM user_crypto_balances
       WHERE user_id = $1 AND currency_code = 'BTC'
       FOR UPDATE`,
      [user.id],
    );

    if (!cryptoRows.length) {
      throw new Error('Portefeuille BTC introuvable.');
    }

    const btcBalance = Number(cryptoRows[0].balance);

    if (direction === 'BUY_BTC') {
      if (fiatBalance < fiatAmount) {
        throw new Error(`Solde ${currency} insuffisant.`);
      }

      balances[currency] = Number((fiatBalance - fiatAmount).toFixed(2));

      await connection.query(
        'UPDATE wallets SET balances = $1::jsonb WHERE user_id = $2',
        [JSON.stringify(balances), user.id],
      );

      await connection.query(
        `UPDATE user_crypto_balances
         SET balance = balance + $1
         WHERE user_id = $2 AND currency_code = 'BTC'`,
        [btcAmount, user.id],
      );
    } else {
      if (btcBalance < btcAmount) {
        throw new Error('Solde BTC insuffisant.');
      }

      balances[currency] = Number((fiatBalance + fiatAmount).toFixed(2));

      await connection.query(
        `UPDATE user_crypto_balances
         SET balance = balance - $1
         WHERE user_id = $2 AND currency_code = 'BTC'`,
        [btcAmount, user.id],
      );

      await connection.query(
        'UPDATE wallets SET balances = $1::jsonb WHERE user_id = $2',
        [JSON.stringify(balances), user.id],
      );
    }

    const transactionMetadata = {
      operation: 'BTC_FIAT_EXCHANGE',
      direction,
      cryptoCurrency: 'BTC',
      fiatCurrency: currency,
      btcAmount,
      fiatAmount,
      marketPrice,
      rateProvider: 'exchange_rates',
      reference,
      executedAt: new Date().toISOString(),
    };

    await connection.query(
      `INSERT INTO transactions (
         reference_code, type_code, status, amount, currency,
         fee, description, sender_id, receiver_id,
         sender_wallet_id, receiver_wallet_id, metadata
       )
       VALUES ($1, 'EXCHANGE', 'Completed', $2, $3,
               0, $4, $5, NULL, $6, NULL, $7::jsonb)`,
      [
        reference,
        fiatAmount,
        currency,
        direction === 'BUY_BTC'
          ? `Achat de ${btcAmount} BTC`
          : `Vente de ${btcAmount} BTC`,
        user.id,
        user.id_wallet ?? null,
        JSON.stringify(transactionMetadata),
      ],
    );

    await connection.query('COMMIT');
    transactionStarted = false;

    // Notifications are sent after the financial transaction commits.
    await createNotification(
      Number(user.id),
      'Échange BTC effectué',
      direction === 'BUY_BTC'
        ? `Achat de ${btcAmount} BTC pour ${fiatAmount} ${currency}. Taux: 1 BTC = ${marketPrice} ${currency}. Réf: ${reference}`
        : `Vente de ${btcAmount} BTC pour ${fiatAmount} ${currency}. Taux: 1 BTC = ${marketPrice} ${currency}. Réf: ${reference}`,
      'general',
    );

    return NextResponse.json({
      success: true,
      reference,
      direction,
      currency,
      btcAmount,
      fiatAmount,
      rate: marketPrice,
      rateProvider: 'exchange_rates',
      fee: 0,
      balances: {
        fiat: balances[currency],
        btc: direction === 'BUY_BTC'
          ? Number((btcBalance + btcAmount).toFixed(8))
          : Number((btcBalance - btcAmount).toFixed(8)),
      },
      message: 'Échange enregistré avec succès.',
    });
  } catch (error: unknown) {
    if (connection && transactionStarted) {
      try {
        await connection.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Échec du rollback de l’échange BTC:', rollbackError);
      }
    }

    const message =
      error instanceof Error ? error.message : 'Erreur pendant l’échange BTC.';

    console.error('Crypto exchange error:', error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    );
  } finally {
    connection?.release();
  }
}
