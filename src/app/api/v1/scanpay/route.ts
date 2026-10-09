import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { verifyUserPin } from '@/lib/actions/auth.actions';
import { processQrSale } from '@/lib/actions/agent.actions';

function parseScanData(value: string) {
    const text = value.trim();

    if (!text) {
        throw new Error('Donnée de scan vide.');
    }

    try {
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Format de scan invalide.');
        }

        return parsed;
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

function normalizeSale(data: any) {
    if (data.type !== 'POS_SALE') {
        throw new Error('Ce code ne correspond pas à une vente POS.');
    }

    const sellerWalletId = String(data.sellerWalletId || '').trim();
    const amount = Number(data.amount);
    const currency = String(data.currency || '').trim().toUpperCase();

    if (!sellerWalletId) {
        throw new Error('Portefeuille vendeur absent.');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Montant de vente invalide.');
    }

    if (!currency) {
        throw new Error('Devise de vente absente.');
    }

    const items = Array.isArray(data.items)
        ? data.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            quantity: Number(item.quantity || 0),
            sellingPrice: Number(item.sellingPrice ?? item.price ?? 0)
        }))
        : [];

    return {
        type: 'POS_SALE',
        sellerWalletId,
        amount,
        currency,
        paymentCurrency: String(data.paymentCurrency || currency).toUpperCase(),
        saleReference: data.saleReference || null,
        boutiqueName: data.boutiqueName || null,
        sellerName: data.sellerName || null,
        items
    };
}

export async function GET(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Session CashPay invalide ou expirée.' },
                { status: 401 }
            );
        }

        const value = request.nextUrl.searchParams.get('data');

        if (!value) {
            return NextResponse.json(
                { success: false, error: 'Paramètre data manquant.' },
                { status: 400 }
            );
        }

        const scanned = parseScanData(value);

        if (scanned.type === 'WALLET') {
            return NextResponse.json({
                success: true,
                scan: {
                    type: 'WALLET',
                    walletId: scanned.walletId
                }
            });
        }

        if (scanned.type === 'BARCODE') {
            return NextResponse.json({
                success: true,
                scan: {
                    type: 'BARCODE',
                    value: scanned.value
                }
            });
        }

        const sale = normalizeSale(scanned);

        return NextResponse.json({
            success: true,
            scan: sale
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

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Session CashPay invalide ou expirée.' },
                { status: 401 }
            );
        }

        const body = await request.json();

        const pin = String(body.pin || '');
        const scanData = body.scanData;

        if (!pin || !/^\d{4}$/.test(pin)) {
            return NextResponse.json(
                { success: false, error: 'Code PIN invalide.' },
                { status: 400 }
            );
        }

        if (!scanData) {
            return NextResponse.json(
                { success: false, error: 'Donnée de paiement absente.' },
                { status: 400 }
            );
        }

        const scanned =
            typeof scanData === 'string'
                ? parseScanData(scanData)
                : scanData;

        const sale = normalizeSale(scanned);

        const pinVerification = await verifyUserPin(user.id, pin);

        if (!pinVerification.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: pinVerification.error || 'Code PIN incorrect.'
                },
                { status: 401 }
            );
        }

        const transaction = await processQrSale(user.id, sale);

        if (!transaction.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: transaction.error || 'Le paiement POS a échoué.'
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Paiement POS effectué avec succès.',
            transaction: {
                type: sale.type,
                saleReference: sale.saleReference,
                sellerWalletId: sale.sellerWalletId,
                amount: sale.amount,
                currency: sale.currency,
                boutiqueName: sale.boutiqueName
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Erreur lors du paiement POS.'
            },
            { status: 500 }
        );
    }
}
