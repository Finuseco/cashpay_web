import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCardById } from '@/lib/actions/card.actions';

export async function GET(
    _request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Identification requise.' },
                { status: 401 }
            );
        }

        const card = await getCardById(params.id, user.id);

        if (!card) {
            return NextResponse.json(
                { success: false, error: 'Carte introuvable.' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            card,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Impossible de récupérer la carte.' },
            { status: 500 }
        );
    }
}
