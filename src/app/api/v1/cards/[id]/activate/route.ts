import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { activatePhysicalCard } from '@/lib/actions/card.actions';

export async function POST(
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

        const result = await activatePhysicalCard(params.id, user.id);

        return NextResponse.json(
            result,
            { status: result.success ? 200 : 400 }
        );
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Impossible d’activer la carte.'
            },
            { status: 500 }
        );
    }
}
