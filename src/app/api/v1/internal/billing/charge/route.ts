
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiSignature } from '@/lib/api-security';
import { createTransaction } from '@/lib/actions/transaction.actions';
import { formatUser } from '@/lib/utils';

/**
 * API Inter-Services : Facturation directe d'un abonnement.
 * Débite l'utilisateur et crédite le portefeuille de revenus.
 */
export async function POST(request: Request) {
    // 1. Validation de la signature HMAC (Souveraineté & Sécurité)
    const security = await validateApiSignature(request);
    if (!security.isValid) {
        return NextResponse.json({ success: false, error: security.error }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { userId, walletId, amount, currency, serviceName, description, reference } = body;

        if (!walletId || !amount || !currency) {
            return NextResponse.json({ success: false, error: "Missing required fields: walletId, amount, currency." }, { status: 400 });
        }

        const connection = await db.getConnection();
        try {
            await connection.query('BEGIN');

            // 2. Récupérer l'utilisateur pour le débit
            const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id_wallet = $1 FOR UPDATE', [walletId]);
            if (userRows.length === 0) {
                throw new Error("Utilisateur introuvable pour ce Wallet ID.");
            }
            const user = formatUser(userRows[0]);

            // 3. Identifier le portefeuille de revenus (ID forcé pour ce flux interne)
            const REVENUE_WALLET_ID = 'CD0100000002';
            
            // 4. Exécuter la transaction via le moteur financier
            // createTransaction gère déjà la vérification du solde et l'atomicité
            const txResult = await createTransaction({
                user,
                typeCode: 'SERVICE_SUB',
                amount: parseFloat(amount),
                currency,
                description: description || `Abonnement ${serviceName}`,
                receiver_wallet_id: REVENUE_WALLET_ID,
                metadata: { 
                    internal_billing: true, 
                    source_app: request.headers.get('X-CashPay-App-ID'),
                    external_ref: reference 
                },
                connection
            });

            if (!txResult.success) {
                throw new Error(txResult.error || "Échec de la transaction de débit.");
            }

            await connection.query('COMMIT');

            return NextResponse.json({
                success: true,
                transactionId: txResult.transactionId,
                reference: txResult.reference,
                amount: amount,
                currency: currency,
                status: 'Completed',
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            await connection.query('ROLLBACK');
            const status = error.message.includes('insuffisant') ? 402 : 400;
            return NextResponse.json({ success: false, error: error.message }, { status });
        } finally {
            connection.release();
        }

    } catch (e: any) {
        return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
    }
}
