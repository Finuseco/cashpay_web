import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Session CashPay invalide ou expirée.'
                },
                { status: 401 }
            );
        }

        const body = await request.json();

        const paymentLinkId = String(
            body.paymentLinkId || ''
        ).trim();

        if (!paymentLinkId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Identifiant Payment Link manquant.'
                },
                { status: 400 }
            );
        }

        if (!paymentLinkId.startsWith('l_')) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Identifiant Payment Link invalide.'
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            paymentLink: {
                id: paymentLinkId
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Impossible de traiter le Payment Link.'
            },
            { status: 500 }
        );
    }
}
