import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getTronUsdtBalance } from '@/services/tron';
import {
  getUserUsdtAddress,
  getUsdtLedgerBalance,
  syncUsdtDepositsForUser,
} from '@/services/usdt';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    const userId = Number(user.id);
    const address = await getUserUsdtAddress(userId);

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: 'USDT_ADDRESS_NOT_CONFIGURED',
          message: 'Aucune adresse USDT TRC-20 n’est encore attribuée à ce compte.',
        },
        { status: 404 },
      );
    }

    // Crédite d'abord les dépôts récents : un dépôt apparaît sans attendre.
    await syncUsdtDepositsForUser(userId);

    // Le solde utilisable est celui du registre CashPay (il tient compte des
    // dépôts, des transferts internes et des retraits).
    const balance = await getUsdtLedgerBalance(userId);

    // Information complémentaire : ce qui se trouve sur l'adresse on-chain.
    let onChainBalance: number | null = null;

    try {
      onChainBalance = (await getTronUsdtBalance(address)).balance;
    } catch (error) {
      console.error('[USDT_TRC20_BALANCE] Solde on-chain indisponible', error);
    }

    return NextResponse.json({
      success: true,
      currency: 'USDT_TRC20',
      network: 'TRC20',
      address,
      balance,
      onChainBalance,
      source: 'CASHPAY_LEDGER',
    });
  } catch (error) {
    console.error('[USDT_TRC20_BALANCE]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'USDT_BALANCE_UNAVAILABLE',
        message: 'Impossible de consulter le solde USDT TRC-20.',
      },
      { status: 500 },
    );
  }
}
