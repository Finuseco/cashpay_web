import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { terminateCard } from '@/lib/actions/card.actions';

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

        let reasonCode = '00';

        try {
            const body = await request.json();
            if (typeof body?.reasonCode === 'string' && body.reasonCode.trim()) {
                reasonCode = body.reasonCode.trim();
            }
        } catch {
        }

        const result = await terminateCard(
            params.id,
            user.id,
            reasonCode
        );

        return NextResponse.json(
            result,
            { status: result.success ? 200 : 400 }
        );
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Impossible de résilier la carte.'
            },
            { status: 500 }
        );
    }
}
