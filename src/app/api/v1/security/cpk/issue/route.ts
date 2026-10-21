import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { signTransactionWithHardwareKey } from '@/lib/actions/security.actions';

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
    const { amount, currency, securityLevel, keyPin, userPin } = body;
    const amountNumber = Number(amount);
    const normalizedCurrency =
        typeof currency === 'string' ? currency.trim().toUpperCase() : '';
    const level = securityLevel || 'none';

    if (
        !Number.isFinite(amountNumber) ||
        amountNumber <= 0 ||
        !normalizedCurrency ||
        typeof userPin !== 'string' ||
        !userPin
    ) {
        return NextResponse.json(
            { success: false, error: 'Montant, devise et PIN personnel requis.' },
            { status: 400 }
        );
    }

    if (!['none', 'pin_protected'].includes(level)) {
        return NextResponse.json(
            { success: false, error: 'Niveau de sécurité invalide.' },
            { status: 400 }
        );
    }

    if (level === 'pin_protected' && (typeof keyPin !== 'string' || !keyPin)) {
        return NextResponse.json(
            { success: false, error: 'Le PIN de la clé est obligatoire.' },
            { status: 400 }
        );
    }

    const result = await signTransactionWithHardwareKey({
        amount: amountNumber,
        currency: normalizedCurrency,
        securityLevel: level,
        keyPin,
        userPin
    });

    if (!result.success) {
        return NextResponse.json(
            { success: false, error: result.error || 'Émission impossible.' },
            { status: 400 }
        );
    }

    return NextResponse.json(result, { status: 201 });
} catch (error) {
    console.error('[CPK ISSUE]', error);
    return NextResponse.json(
        { success: false, error: 'Erreur interne lors de l’émission.' },
        { status: 500 }
    );
}

}
