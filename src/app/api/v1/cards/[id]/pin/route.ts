import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { setCardPin } from '@/lib/actions/card.actions';

export async function POST(
    request: Request,
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

        const body = await request.json();
        const pin = typeof body?.pin === 'string' ? body.pin : '';

        if (!/^\d{4,6}$/.test(pin)) {
            return NextResponse.json(
                { success: false, error: 'PIN invalide.' },
                { status: 400 }
            );
        }

        const result = await setCardPin(params.id, user.id, pin);

        return NextResponse.json(
            result,
            { status: result.success ? 200 : 400 }
        );
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Impossible de modifier le PIN de la carte.'
            },
            { status: 500 }
        );
    }
}
