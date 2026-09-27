import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { revealCardDetails } from '@/lib/actions/card.actions';

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

        const result = await revealCardDetails(params.id, user.id);

        if (!result.success) {
            return NextResponse.json(result, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Impossible de récupérer les détails.' },
            { status: 500 }
        );
    }
}
