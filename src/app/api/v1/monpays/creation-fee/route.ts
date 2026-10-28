import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getMonPaysCreationFee } from '@/lib/actions/monpays.actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/monpays/creation-fee?currency=USD
 * Retourne les frais de création d'une page MonPays pour l'utilisateur connecté.
 *
 * Le frais est calculé selon :
 *   1. Le country_code de l'utilisateur connecté (lookup dans fee_structures)
 *   2. Fallback vers GBL si aucune règle pays-spécifique n'existe
 *   3. Conversion automatique dans la devise demandée
 *
 * Query params:
 *   currency?: string  (ex: "USD", "CDF", "EUR") — défaut: "USD"
 *
 * Réponse:
 *   { success: true, fee: 30.00, currency: "USD", referenceFeeUSD: 30.00, countryCode: "CD" }
 */
export async function GET(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const currency = (searchParams.get('currency') || 'USD').toUpperCase();

    const result = await getMonPaysCreationFee(currency);

    if (!result.success) {
        return NextResponse.json(
            { success: false, error: result.error || 'Frais indisponibles.' },
            { status: 400 }
        );
    }

    return NextResponse.json({
        success: true,
        fee: result.fee,
        currency: result.currency ?? currency,
        referenceFeeUSD: result.referenceFeeUSD,
        countryCode: user.country || 'GBL',
    });
}
