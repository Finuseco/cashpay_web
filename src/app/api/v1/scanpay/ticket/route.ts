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

        const ticketCode = String(body.ticketCode || '').trim();
        const eventId = String(body.eventId || '').trim();

        if (!ticketCode) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Code ticket manquant.'
                },
                { status: 400 }
            );
        }

        if (!eventId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Identifiant événement manquant.'
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            ticket: {
                ticketCode,
                eventId
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Impossible de traiter le ticket.'
            },
            { status: 500 }
        );
    }
}
