import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { db } from '@/lib/db';
import { generateReferenceCode } from '@/lib/utils';

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

function parseJsonObject(value: unknown): Record<string, number> {
  if (!value) return {};

  try {
    const parsed =
      typeof value === 'string'
        ? JSON.parse(value)
        : value;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const result: Record<string, number> = {};

    for (const [currency, amount] of Object.entries(parsed as Record<string, unknown>)) {
      const normalizedCurrency = String(currency || '').trim();

      if (!normalizedCurrency) continue;

      const numericAmount = Number(amount);

      if (!Number.isFinite(numericAmount)) continue;

      result[normalizedCurrency] = numericAmount;
    }

    return result;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return errorResponse('Authentification requise.', 401);
    }

    const role = String(user.role || '')
      .trim()
      .toLowerCase();

    if (role !== 'agent') {
      return errorResponse(
        'Vous n’êtes pas autorisé à utiliser ce service. Un compte Agent est requis.',
        403
      );
    }

    let body: any;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        'Corps de requête JSON invalide.',
        400
      );
    }

    const currency = String(body?.currency || '').trim();

    if (!currency) {
      return errorResponse(
        'La devise de la commission est obligatoire.',
        400
      );
    }

    const requestedAmount = Number(body?.amount);

    if (
      !Number.isFinite(requestedAmount) ||
      requestedAmount <= 0
    ) {
      return errorResponse(
        'Le montant de la commission est invalide.',
        400
      );
    }

    await connection.query('BEGIN');

    /*
     * Verrouillage du portefeuille Agent.
     * L'identité provient uniquement du token.
     */
    const { rows } = await connection.query(
      `
        SELECT
          balances,
          commission_balance
        FROM wallets
        WHERE user_id = $1::integer
        FOR UPDATE
      `,
      [user.id]
    );

    if (!rows.length) {
      throw new Error('Portefeuille Agent introuvable.');
    }

    const balances = parseJsonObject(rows[0].balances);
    const commissionBalance = parseJsonObject(
      rows[0].commission_balance
    );

    /*
     * La devise n'est pas comparée à une liste codée en dur.
     * Elle doit réellement exister dans commission_balance.
     */
    if (
      !Object.prototype.hasOwnProperty.call(
        commissionBalance,
        currency
      )
    ) {
      throw new Error(
        `Aucune commission disponible dans la devise ${currency}.`
      );
    }

    const available = Number(
      commissionBalance[currency] || 0
    );

    if (
      !Number.isFinite(available) ||
      available <= 0
    ) {
      throw new Error(
        `Aucune commission disponible dans la devise ${currency}.`
      );
    }

    if (requestedAmount > available + 0.0000001) {
      throw new Error(
        `Montant supérieur à la commission disponible (${available} ${currency}).`
      );
    }

    const amount =
      Math.round(
        (requestedAmount + Number.EPSILON) * 100
      ) / 100;

    const remainingCommission =
      Math.round(
        (available - amount + Number.EPSILON) * 100
      ) / 100;

    const currentMainBalance = Number(
      balances[currency] || 0
    );

    const newMainBalance =
      Math.round(
        (currentMainBalance + amount + Number.EPSILON) * 100
      ) / 100;

    commissionBalance[currency] = remainingCommission;
    balances[currency] = newMainBalance;

    await connection.query(
      `
        UPDATE wallets
        SET
          commission_balance = $1::jsonb,
          balances = $2::jsonb
        WHERE user_id = $3::integer
      `,
      [
        JSON.stringify(commissionBalance),
        JSON.stringify(balances),
        user.id,
      ]
    );

    const reference = generateReferenceCode(
      'MLM_COMM_CLAIM'
    );

    const { rows: txRows } = await connection.query(
      `
        INSERT INTO transactions (
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
        VALUES (
          $1::text,
          'MLM_COMM_CLAIM',
          'Completed',
          $2::numeric,
          $3::text,
          0::numeric,
          $4::text,
          $5::integer,
          $5::integer,
          $6::text,
          $6::text,
          $7::jsonb
        )
        RETURNING id
      `,
      [
        reference,
        amount,
        currency,
        `Bascule de commission vers le portefeuille principal`,
        user.id,
        user.id_wallet,
        JSON.stringify({
          operation: 'COMMISSION_TRANSFER',
          agent_id: user.id,
          currency,
          amount,
          source: 'commission_balance',
          destination: 'wallet_balance',
          authorization: 'cashpay-token',
        }),
      ]
    );

    await connection.query('COMMIT');

    return NextResponse.json({
      success: true,
      data: {
        reference,
        transactionId: txRows[0]?.id || null,
        currency,
        transferredAmount: amount,
        commissionBalance: remainingCommission,
        mainBalance: newMainBalance,
      },
    });
  } catch (error: any) {
    try {
      await connection.query('ROLLBACK');
    } catch {}

    console.error(
      '[API Agent Commission Transfer]',
      error
    );

    return errorResponse(
      error?.message ||
        'Impossible de basculer la commission.',
      400
    );
  } finally {
    connection.release();
  }
}
