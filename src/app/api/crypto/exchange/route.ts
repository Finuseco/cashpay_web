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
type Crypto = 'BTC' | 'USDT';
type Direction = 'BUY_BTC' | 'SELL_BTC' | 'BUY_USDT' | 'SELL_USDT';

async function getCryptoPrice(
  crypto: Crypto,
  fiat: FiatCurrency,
  countryCode: string,
  direction: Direction,
): Promise<number> {
  if (crypto === 'BTC') {
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
      [countryCode, fiat],
    );

    if (!rows.length) {
      throw new Error(`Taux BTC/${fiat} absent pour le pays ${countryCode}.`);
    }

    const rate = Number(rows[0].rate);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('Le taux BTC enregistré est invalide.');
    }

    return rows[0].from_currency === 'BTC' ? rate : 1 / rate;
  }

  // Les taux USDT sont stockés sous le code USDT dans exchange_rates.
  // Achat : fiat -> USDT. Vente : USDT -> fiat.
  const from = direction === 'BUY_USDT' ? fiat : 'USDT';
  const to = direction === 'BUY_USDT' ? 'USDT' : fiat;

  const { rows } = await db.query(
    `SELECT rate
       FROM exchange_rates
      WHERE country_code = $1
        AND from_currency = $2
        AND to_currency = $3
      ORDER BY created_at DESC
      LIMIT 1`,
    [countryCode, from, to],
  );

  if (!rows.length) {
    throw new Error(`Taux ${from}/${to} absent pour le pays ${countryCode}.`);
  }

  const rate = Number(rows[0].rate);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Le taux ${from}/${to} enregistré est invalide.`);
  }

  // Pour BUY_USDT, le taux représente les USDT obtenus par unité fiat.
  // Pour SELL_USDT, il représente la devise fiat obtenue par USDT.
  return rate;
}

export async function POST(request: NextRequest) {
  let connection: Awaited<ReturnType<typeof db.getConnection>> | undefined;
  let transactionStarted = false;

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session invalide. Veuillez vous reconnecter.',
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const direction = String(body?.direction ?? '').toUpperCase() as Direction;

    if (!['BUY_BTC', 'SELL_BTC', 'BUY_USDT', 'SELL_USDT'].includes(direction)) {
      return NextResponse.json(
        { success: false, error: 'Direction invalide.' },
        { status: 400 },
      );
    }

    const countryCode = countryToCode(user.country);

    if (!countryCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pays du compte introuvable ou non reconnu.',
        },
        { status: 400 },
      );
    }

    const localCurrency = countries.find(
      (country) => country.code === countryCode,
    )?.currency_code;

    if (!localCurrency) {
      return NextResponse.json(
        {
          success: false,
          error: 'Devise locale introuvable pour ce pays.',
        },
        { status: 400 },
      );
    }

    const requestedCurrency = String(body?.currency ?? '').trim().toUpperCase();
    const currency: FiatCurrency = requestedCurrency || localCurrency;
    const amount = Number(body?.amount);
    const pin = String(body?.pin ?? '');

    if (
      !/^[A-Z]{3}$/.test(currency) ||
      ![localCurrency, 'USD', 'EUR'].includes(currency)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Devise non autorisée. Devise locale : ${localCurrency}.`,
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
        {
          success: false,
          error: pinResult.error || 'PIN incorrect.',
        },
        { status: 401 },
      );
    }

    const isUsdt = direction === 'BUY_USDT' || direction === 'SELL_USDT';
    const isBuy = direction === 'BUY_BTC' || direction === 'BUY_USDT';
    const crypto: Crypto = isUsdt ? 'USDT' : 'BTC';
    const ledgerCurrency = isUsdt ? 'USDT_TRC20' : 'BTC';
    const decimals = isUsdt ? 6 : 8;

    const marketPrice = await getCryptoPrice(
      crypto,
      currency,
      countryCode,
      direction,
    );

    // Achat BTC : amount est la somme fiat dépensée.
    // Achat USDT : amount est multiplié par le taux fiat -> USDT.
    // Vente : amount est la quantité de crypto vendue.
    const fiatAmount = isBuy
      ? Number(amount.toFixed(2))
      : Number((amount * marketPrice).toFixed(2));

    const cryptoAmount = isBuy
      ? isUsdt
        ? Number((amount * marketPrice).toFixed(decimals))
        : Number((amount / marketPrice).toFixed(decimals))
      : Number(amount.toFixed(decimals));

    if (
      !Number.isFinite(fiatAmount) ||
      !Number.isFinite(cryptoAmount) ||
      fiatAmount <= 0 ||
      cryptoAmount <= 0
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

    await connection.query(
      `INSERT INTO user_crypto_balances (user_id, currency_code, balance)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, currency_code) DO NOTHING`,
      [user.id, ledgerCurrency],
    );

    const { rows: cryptoRows } = await connection.query(
      `SELECT balance
         FROM user_crypto_balances
        WHERE user_id = $1
          AND currency_code = $2
        FOR UPDATE`,
      [user.id, ledgerCurrency],
    );

    if (!cryptoRows.length) {
      throw new Error(`Portefeuille ${crypto} introuvable.`);
    }

    const cryptoBalance = Number(cryptoRows[0].balance);

    if (isBuy) {
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
          WHERE user_id = $2
            AND currency_code = $3`,
        [cryptoAmount, user.id, ledgerCurrency],
      );
    } else {
      if (cryptoBalance < cryptoAmount) {
        throw new Error(`Solde ${crypto} insuffisant.`);
      }

      balances[currency] = Number((fiatBalance + fiatAmount).toFixed(2));

      await connection.query(
        `UPDATE user_crypto_balances
            SET balance = balance - $1
          WHERE user_id = $2
            AND currency_code = $3`,
        [cryptoAmount, user.id, ledgerCurrency],
      );

      await connection.query(
        'UPDATE wallets SET balances = $1::jsonb WHERE user_id = $2',
        [JSON.stringify(balances), user.id],
      );
    }

    const transactionMetadata = {
      operation: `${crypto}_FIAT_EXCHANGE`,
      direction,
      cryptoCurrency: crypto,
      ledgerCurrency,
      fiatCurrency: currency,
      cryptoAmount,
      fiatAmount,
      marketPrice,
      rateProvider: 'exchange_rates',
      reference,
      executedAt: new Date().toISOString(),
    };

    await connection.query(
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
         metadata
       )
       VALUES ($1, 'EXCHANGE', 'Completed', $2, $3, 0, $4, $5, NULL, $6, NULL, $7::jsonb)`,
      [
        reference,
        fiatAmount,
        currency,
        isBuy
          ? `Achat de ${cryptoAmount} ${crypto}`
          : `Vente de ${cryptoAmount} ${crypto}`,
        user.id,
        user.id_wallet ?? null,
        JSON.stringify(transactionMetadata),
      ],
    );

    await connection.query('COMMIT');
    transactionStarted = false;

    // Une erreur de notification ne doit pas annuler l'échange validé.
    try {
      const rateDescription = isUsdt
        ? isBuy
          ? `1 ${currency} = ${marketPrice} USDT`
          : `1 USDT = ${marketPrice} ${currency}`
        : `1 BTC = ${marketPrice} ${currency}`;

      await createNotification(
        Number(user.id),
        `Échange ${crypto} effectué`,
        `${isBuy ? 'Achat' : 'Vente'} de ${cryptoAmount} ${crypto} pour ${fiatAmount} ${currency}. Taux : ${rateDescription}. Réf. : ${reference}`,
        'general',
      );
    } catch (notificationError) {
      console.error(
        'Échec de notification après échange validé :',
        notificationError,
      );
    }

    const updatedCryptoBalance = Number(
      (
        isBuy
          ? cryptoBalance + cryptoAmount
          : cryptoBalance - cryptoAmount
      ).toFixed(decimals),
    );

    return NextResponse.json({
      success: true,
      reference,
      direction,
      currency,
      ...(isUsdt
        ? { usdtAmount: cryptoAmount }
        : { btcAmount: cryptoAmount }),
      fiatAmount,
      rate: marketPrice,
      rateProvider: 'exchange_rates',
      fee: 0,
      balances: {
        fiat: balances[currency],
        [isUsdt ? 'usdt' : 'btc']: updatedCryptoBalance,
      },
      message: 'Échange enregistré avec succès.',
    });
  } catch (error: unknown) {
    if (connection && transactionStarted) {
      try {
        await connection.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Échec du rollback de l’échange crypto :', rollbackError);
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Erreur pendant l’échange crypto.';

    console.error('Crypto exchange error:', error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    );
  } finally {
    connection?.release();
  }
}
