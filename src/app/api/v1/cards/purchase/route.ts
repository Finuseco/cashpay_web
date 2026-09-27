import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { purchaseCard } from '@/lib/actions/card.actions';

export async function POST(request: Request) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Identification requise.' },
                { status: 401 }
            );
        }

        const body = await request.json();

        const { card_type, brand, currency, pin } = body;

        if (!['virtuelle', 'physique'].includes(card_type)) {
            return NextResponse.json(
                { success: false, error: 'Type de carte invalide.' },
                { status: 400 }
            );
        }

        if (!['visa', 'mastercard'].includes(String(brand).toLowerCase())) {
            return NextResponse.json(
                { success: false, error: 'Marque de carte invalide.' },
                { status: 400 }
            );
        }

        if (!currency || typeof currency !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Devise obligatoire.' },
                { status: 400 }
            );
        }

        if (!pin || typeof pin !== 'string') {
            return NextResponse.json(
                { success: false, error: 'PIN obligatoire.' },
                { status: 400 }
            );
        }

        const result = await purchaseCard({
            user,
            card_type,
            brand: String(brand).toLowerCase() as 'visa' | 'mastercard',
            currency: currency.toUpperCase(),
            pin,
        });

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Échec de l’achat de la carte.' },
            { status: 500 }
        );
    }
}
