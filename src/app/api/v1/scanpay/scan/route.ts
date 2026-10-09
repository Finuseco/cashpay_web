import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

function parseScanValue(value: string) {
    const text = value.trim();

    if (!text) {
        throw new Error('Donnée de scan vide.');
    }

    try {
        const data = JSON.parse(text);

        if (!data || typeof data !== 'object') {
            throw new Error('Format QR invalide.');
        }

        if (data.type === 'POS_SALE') {
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
                paymentCurrency: String(
                    data.paymentCurrency || currency
                ).toUpperCase(),
                saleReference: data.saleReference || null,
                boutiqueName: data.boutiqueName || null,
                sellerName: data.sellerName || null,
                items: Array.isArray(data.items) ? data.items : []
            };
        }

        if (data.type === 'PAYMENT_REQUEST') {
            return {
                type: 'PAYMENT_REQUEST',
                recipient: data.recipient || null,
                amount: Number(data.amount || 0),
                currency: String(data.currency || '').toUpperCase()
            };
        }

        if (data.type === 'PRODUCT') {
            if (!data.productId) {
                throw new Error('Identifiant produit absent.');
            }

            return {
                type: 'PRODUCT',
                productId: data.productId
            };
        }

        return {
            type: String(data.type || 'UNKNOWN'),
            data
        };
    } catch {
        if (/^[A-Z]{2}\d{10}$/.test(text)) {
            return {
                type: 'WALLET',
                walletId: text
            };
        }

        return {
            type: 'BARCODE',
            value: text
        };
    }
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

        const value = String(
            body.value || body.data || ''
        ).trim();

        if (!value) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Aucune donnée de scan reçue.'
                },
                { status: 400 }
            );
        }

        const scan = parseScanValue(value);

        return NextResponse.json({
            success: true,
            scan
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Impossible de traiter le scan.'
            },
            { status: 400 }
        );
    }
}
