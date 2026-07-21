
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { signTransactionWithHardwareKey } from '@/lib/actions/security.actions';

/**
 * API : Émettre une nouvelle clé matérielle .CPK
 * Débite l'utilisateur (incluant les frais HSM_LOCK)
 */
export async function POST(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { amount, currency, securityLevel, keyPin, userPin } = body;

        if (!amount || !currency || !userPin) {
            return NextResponse.json({ success: false, error: "Champs obligatoires manquants" }, { status: 400 });
        }

        const result = await signTransactionWithHardwareKey({
            amount: parseFloat(amount),
            currency,
            securityLevel: securityLevel || 'none',
            keyPin,
            userPin
        });

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Erreur interne" }, { status: 500 });
    }
}
