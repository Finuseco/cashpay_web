import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserAbonnements } from '@/lib/actions/bills.actions';
import {
  getRegidesoInvoices,
  REGIDESO_PROVINCES,
  type RegidesoProvince,
} from '@/lib/regideso/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      );
    }

    const userId = Number(user.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Identité utilisateur invalide.' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const abonnementId = url.searchParams
      .get('abonnementId')?.trim();
    const requestedProvince = (
      url.searchParams.get('province') || 'KIN'
    ).toUpperCase();

    if (
      !REGIDESO_PROVINCES.includes(
        requestedProvince as RegidesoProvince
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Code province invalide.' },
        { status: 400 }
      );
    }

    const abonnements = await getUserAbonnements(userId);

    const targets = abonnementId
      ? abonnements.filter(
          (item) => item.abonnement_id === abonnementId
        )
      : abonnements;

    if (abonnementId && targets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Abonnement introuvable ou non autorisé.',
        },
        { status: 403 }
      );
    }

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        factures: [],
        abonnements: [],
        message: 'Aucun abonnement REGIDESO enregistré.',
      });
    }

    const results = await Promise.all(
      targets.map(async (item) => {
        try {
          const response = await getRegidesoInvoices(
            item.abonnement_id,
            requestedProvince as RegidesoProvince
          );

          return {
            abonnementId: item.abonnement_id,
            alias: item.alias,
            success: response?.success === true,
            message: response?.message,
            factures: Array.isArray(response?.data)
              ? response.data
              : [],
          };
        } catch (error) {
          console.error(
            '[REGIDESO consultation]',
            item.abonnement_id,
            error
          );

          return {
            abonnementId: item.abonnement_id,
            alias: item.alias,
            success: false,
            factures: [],
            error: 'Consultation REGIDESO indisponible.',
          };
        }
      })
    );

    const failed = results.some((item) => !item.success);

    return NextResponse.json(
      {
        success: !failed,
        abonnements: results,
        factures: results.flatMap((item) =>
          item.factures.map((facture: Record<string, unknown>) => ({
            ...facture,
            abonnementId: item.abonnementId,
            alias: item.alias,
          }))
        ),
      },
      {
        status: failed ? 502 : 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('[REGIDESO invoices route]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la consultation des factures.',
      },
      { status: 502 }
    );
  }
}
