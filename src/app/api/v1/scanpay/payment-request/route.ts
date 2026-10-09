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

        const recipient = String(body.recipient || '').trim();
        const amount = Number(body.amount);
        const currency = String(body.currency || '').trim().toUpperCase();

        if (!recipient) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Destinataire manquant.'
                },
                { status: 400 }
            );
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Montant invalide.'
                },
                { status: 400 }
            );
        }

        if (!currency) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Devise manquante.'
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            paymentRequest: {
                recipient,
                amount,
                currency
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Impossible de traiter la demande de paiement.'
            },
            { status: 500 }
        );
    }
}
