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
        const walletId = String(body.walletId || '').trim();

        if (!walletId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Identifiant du portefeuille manquant.'
                },
                { status: 400 }
            );
        }

        if (!/^[A-Z]{2}\d{10}$/.test(walletId)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Identifiant du portefeuille invalide.'
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            wallet: {
                walletId
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Impossible de traiter le portefeuille.'
            },
            { status: 500 }
        );
    }
}
