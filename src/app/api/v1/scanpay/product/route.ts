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

        const productId = String(body.productId || '').trim();
        const barcode = String(body.barcode || '').trim();

        if (!productId && !barcode) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Identifiant produit ou code-barres manquant.'
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            lookup: {
                productId: productId || null,
                barcode: barcode || null
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Impossible de traiter le produit.'
            },
            { status: 500 }
        );
    }
}
