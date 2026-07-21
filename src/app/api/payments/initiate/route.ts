
'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { createMerchantPayment } from '@/lib/actions/payment.actions';

const getBaseUrl = () => {
    if (process.env.NODE_ENV === 'development') {
        return `http://localhost:8003`;
    }
    return `https://www.cashpay-all.com:8003`;
};

/**
 * API endpoint for merchants to initiate a payment.
 * It creates a payment record and returns a secure URL to the payment gateway.
 */
export async function POST(request: NextRequest) {
    // In a real app, you would authenticate the merchant via API key here.
    // const authHeader = request.headers.get('Authorization');
    // const apiKey = authHeader?.split(' ')[1];
    // if (!isValidApiKey(apiKey)) {
    //     return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    // }

    try {
        const body = await request.json();
        
        const result = await createMerchantPayment({
            // merchantId would come from the authenticated API key
            merchantId: 'merchant_123', // Mock merchant ID
            amount: body.amount,
            currency: body.currency,
            reference: body.reference,
            description: body.description,
            redirectUrl: body.redirect_url,
            webhookUrl: body.webhook_url,
        });

        if (result.success && result.paymentId) {
            const paymentUrl = `${getBaseUrl()}/pay/${result.paymentId}`;
            return NextResponse.json({
                success: true,
                message: 'Payment initiated successfully.',
                payment_url: paymentUrl,
                payment_id: result.paymentId
            });
        } else {
            return NextResponse.json({ success: false, error: result.error || 'Failed to initiate payment.' }, { status: 400 });
        }

    } catch (error) {
        console.error('[API Initiate Payment] Error:', error);
        return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
    }
}
