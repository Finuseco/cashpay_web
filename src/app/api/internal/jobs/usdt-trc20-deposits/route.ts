import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  syncAllUsdtDeposits,
  reconcilePendingUsdtWithdrawals,
  sweepUsdtDeposits,
} from '@/services/usdt';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.USDT_SCAN_SECRET;
  const received = request.headers.get('authorization') ?? '';

  if (!secret) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(received);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Tâche planifiée (toutes les 1 à 2 minutes, depuis le VPS) :
 *  1. crédite les dépôts USDT reçus sur les adresses des utilisateurs ;
 *  2. finalise les retraits USDT diffusés mais pas encore confirmés.
 *
 * Exemple : curl -fsS -X POST -H "Authorization: Bearer $USDT_SCAN_SECRET" \
 *             https://<domaine>/api/internal/jobs/usdt-trc20-deposits
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  if (!process.env.TRON_FULL_HOST) {
    return NextResponse.json(
      { success: false, error: 'TRON_FULL_HOST_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  try {
    const deposits = await syncAllUsdtDeposits();
    const withdrawals = await reconcilePendingUsdtWithdrawals();

    // Balayage vers le portefeuille chaud : uniquement à la demande
    // (?sweep=1, ex. toutes les 10 min) ET si USDT_SWEEP_ENABLED=true.
    const sweep = request.nextUrl.searchParams.get('sweep') === '1'
      ? await sweepUsdtDeposits()
      : undefined;

    return NextResponse.json({
      success: true,
      currency: 'USDT_TRC20',
      eventsReceived: deposits.eventsReceived,
      depositsCredited: deposits.depositsCredited,
      addressesScanned: deposits.addressesScanned,
      addressesFailed: deposits.addressesFailed,
      withdrawals,
      ...(sweep ? { sweep } : {}),
    });
  } catch (error) {
    console.error('[USDT_TRC20_DEPOSIT_SYNC]', error);

    return NextResponse.json(
      { success: false, error: 'DEPOSIT_SYNC_FAILED' },
      { status: 500 },
    );
  }
}
