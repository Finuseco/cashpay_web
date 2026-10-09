import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { db } from '@/lib/db';

function parseBalances(value: unknown): Record<string, number> {
  let parsed: unknown = value;

  try {
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const result: Record<string, number> = {};

  for (const [currency, amount] of Object.entries(parsed)) {
    const normalizedCurrency = String(currency).trim().toUpperCase();
    const numericAmount = Number(amount);

    if (
      normalizedCurrency &&
      Number.isFinite(numericAmount)
    ) {
      result[normalizedCurrency] = numericAmount;
    }
  }

  return result;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentification requise.',
        },
        { status: 401 }
      );
    }

    const userId = Number(user.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Utilisateur authentifié invalide.',
        },
        { status: 401 }
      );
    }

    if (String((user as any).role || '').toLowerCase() !== 'agent') {
      return NextResponse.json(
        {
          success: false,
          error: 'Un compte Agent est requis.',
        },
        { status: 403 }
      );
    }

    const { rows } = await db.query(
      `
        SELECT
          balances,
          commission_balance
        FROM wallets
        WHERE user_id = $1::integer
        LIMIT 1
      `,
      [userId]
    );

    if (!rows.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'Portefeuille introuvable.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      balances: parseBalances(rows[0].balances),
      commissionBalance: parseBalances(rows[0].commission_balance),
    });
  } catch (error: any) {
    console.error('[Agent Commissions GET]', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Erreur interne du service de commissions.',
      },
      { status: 500 }
    );
  }
}
