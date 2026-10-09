import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { verifyUserPin } from '@/lib/actions/auth.actions';
import { processQrSale } from '@/lib/actions/agent.actions';

function validateSale(data: any) {
    if (!data || data.type !== 'POS_SALE') {
        throw new Error('Paiement POS invalide.');
    }

    const sellerWalletId = String(data.sellerWalletId || '').trim();
    const amount = Number(data.amount);
    const currency = String(data.currency || '').trim().toUpperCase();

    if (!sellerWalletId) {
        throw new Error('Portefeuille vendeur absent.');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Montant invalide.');
    }

    if (!currency) {
        throw new Error('Devise absente.');
    }

    return {
        type: 'POS_SALE',
        sellerWalletId,
        amount,
        currency,
        paymentCurrency: String(data.paymentCurrency || currency).toUpperCase(),
        saleReference: data.saleReference || null,
        boutiqueName: data.boutiqueName || null,
        sellerName: data.sellerName || null,
        items: Array.isArray(data.items) ? data.items : []
    };
}

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

        const pin = String(body.pin || '');

        if (!/^\d{4}$/.test(pin)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Code PIN invalide.'
                },
                { status: 400 }
            );
        }

        const sale = validateSale(body.payment || body.scan);

        const pinResult = await verifyUserPin(user.id, pin);

        if (!pinResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: pinResult.error || 'Code PIN incorrect.'
                },
                { status: 401 }
            );
        }

        const result = await processQrSale(user.id, sale);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error || 'Le paiement POS a échoué.'
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Paiement POS effectué avec succès.',
            payment: {
                type: sale.type,
                saleReference: sale.saleReference,
                sellerWalletId: sale.sellerWalletId,
                amount: sale.amount,
                currency: sale.currency,
                paymentCurrency: sale.paymentCurrency,
                boutiqueName: sale.boutiqueName
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Erreur lors du paiement.'
            },
            { status: 500 }
        );
    }
}
