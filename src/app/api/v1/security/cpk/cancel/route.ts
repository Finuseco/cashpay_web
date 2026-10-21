import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { cancelHardwareSignature } from '@/lib/actions/security.actions';

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
    const { reference, pin } = body;

    if (
        typeof reference !== 'string' ||
        !reference.trim() ||
        typeof pin !== 'string' ||
        !pin
    ) {
        return NextResponse.json(
            { success: false, error: 'Référence et PIN requis.' },
            { status: 400 }
        );
    }

    const result = await cancelHardwareSignature({
        reference: reference.trim(),
        userId: user.id,
        pin
    });

    if (!result.success) {
        return NextResponse.json(
            { success: false, error: result.error || 'Annulation impossible.' },
            { status: 400 }
        );
    }

    return NextResponse.json(result);
} catch (error) {
    console.error('[CPK CANCEL]', error);
    return NextResponse.json(
        { success: false, error: 'Erreur interne lors de l’annulation.' },
        { status: 500 }
    );
}

}
