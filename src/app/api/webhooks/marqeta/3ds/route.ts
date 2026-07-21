
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendAndStoreOtp } from '@/lib/actions/auth.actions';
import { validateWebhookSignature } from '@/services/marqeta';

/**
 * Webhook 3D Secure (Delegated Authentication).
 * Souveraineté : CashPay envoie son propre OTP pour sécuriser l'achat.
 * Marqeta délègue la vérification de l'identité du porteur à CashPay.
 */
export async function POST(request: NextRequest) {
    const signature = request.headers.get('x-marqeta-signature');

    try {
        const bodyText = await request.text();
        
        if (signature) {
            const isValid = await validateWebhookSignature(bodyText, signature);
            if (!isValid) return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = JSON.parse(bodyText);
        const { user_token, amount, currency_code } = body;

        const { rows: userRows } = await db.query(
            'SELECT id, full_name FROM users WHERE id = (SELECT user_id FROM cards WHERE marqeta_user_token = $1 LIMIT 1)', 
            [user_token]
        );

        if (userRows.length === 0) {
            return NextResponse.json({ success: false, action: "DECLINE", reason: "User not found" });
        }

        const user = userRows[0];

        // 1. CashPay prend le contrôle et envoie l'OTP via SES PROPRES CANAUX
        const otpResult = await sendAndStoreOtp(
            user.id, 
            `un achat par carte de ${amount} ${currency_code}`, 
            'sms'
        );

        if (otpResult.success) {
            // 2. Informe Marqeta que CashPay gère le challenge
            return NextResponse.json({
                success: true,
                action: "CHALLENGE",
                authentication_method: "OTP_SMS",
                message: "Veuillez entrer le code de sécurité envoyé par CashPay."
            });
        } else {
            return NextResponse.json({
                success: false,
                action: "DECLINE",
                reason: "OTP Delivery Failed"
            });
        }

    } catch (error) {
        console.error('[3DS Webhook] Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
