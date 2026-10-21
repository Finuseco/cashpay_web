import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { recoverSignedBalance } from '@/lib/actions/security.actions';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
try {
const user = await getAuthenticatedUser();

    if (!user) {
        return NextResponse.json(
            { success: false, error: 'Non authentifié.' },
            { status: 401 }
        );
    }

    const body = await request.json();
    const { signature, keyPin, partialAmount } = body;

    if (typeof signature !== 'string' || !signature.trim()) {
        return NextResponse.json(
            { success: false, error: 'Signature manquante.' },
            { status: 400 }
        );
    }

    if (
        partialAmount !== undefined &&
        (
            typeof partialAmount !== 'number' ||
            !Number.isFinite(partialAmount) ||
            partialAmount <= 0
        )
    ) {
        return NextResponse.json(
            { success: false, error: 'Montant partiel invalide.' },
            { status: 400 }
        );
    }

    const result = await recoverSignedBalance({
        signature: signature.trim(),
        keyPin,
        partialAmount
    });

    if (!result.success) {
        return NextResponse.json(
            { success: false, error: result.error || 'Encaissement impossible.' },
            { status: 400 }
        );
    }

    return NextResponse.json(result);
} catch (error) {
    console.error('[CPK RECOVER]', error);
    return NextResponse.json(
        { success: false, error: 'Erreur interne lors de l’encaissement.' },
        { status: 500 }
    );
}

}
