import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCardsForUser } from '@/lib/actions/card.actions';

export async function GET() {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Identification requise.' },
                { status: 401 }
            );
        }

        const cards = await getCardsForUser(user.id, user.full_name);

        return NextResponse.json({
            success: true,
            count: cards.length,
            cards,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Impossible de récupérer les cartes.' },
            { status: 500 }
        );
    }
}
