import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
  getReferralsForUser,
  getReferralConversionRate,
  claimReferralReward,
} from '@/lib/actions/referral.actions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const [referrals, pointConversionRate] = await Promise.all([
      getReferralsForUser(user.id),
      getReferralConversionRate(user.country || 'CD'),
    ]);

    const rate = pointConversionRate ?? 100;

    const pendingCount = referrals.filter(
      (referral) => referral.status === 'Pending Deposit'
    ).length;

    const claimableCount = referrals.filter(
      (referral) =>
        referral.status === 'Active' && !referral.isClaimed
    ).length;

    const claimedCount = referrals.filter(
      (referral) => referral.isClaimed
    ).length;

    return NextResponse.json({
      success: true,
      referral: {
        code: user.id_wallet,
        link: user.id_wallet
          ? `https://cashpay-all.com/referral/${user.id_wallet}`
          : null,
      },
      stats: {
        totalReferrals: referrals.length,
        pendingCount,
        claimableCount,
        claimedCount,
        pointConversionRate: rate,
        claimableAmount: claimableCount * rate,
        totalEarnedAmount: claimedCount * rate,
      },
      referrals,
    });
  } catch (error) {
    console.error('[API REFERRALS GET]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de récupérer les données de parrainage.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    let body: { referralId?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Corps JSON invalide.' },
        { status: 400 }
      );
    }

    const referralId = body.referralId;

    if (
      typeof referralId !== 'number' ||
      !Number.isSafeInteger(referralId) ||
      referralId <= 0
    ) {
      return NextResponse.json(
        { success: false, error: 'Identifiant de parrainage invalide.' },
        { status: 400 }
      );
    }

    // La fonction existante vérifie le propriétaire, le statut,
    // la réclamation précédente et crédite le portefeuille.
    const result = await claimReferralReward(referralId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Impossible de réclamer la récompense.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Récompense de parrainage créditée avec succès.',
      referralId,
    });
  } catch (error) {
    console.error('[API REFERRALS POST]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la réclamation de la récompense.',
      },
      { status: 500 }
    );
  }
}
