
import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyLegacyCardWebhook } from '@/lib/legacy-card-webhook';
const formatJitResponse = (token: string, approved: boolean, amount: number, memo?: string) => ({
    jit_funding: { token, method: approved ? 'pgfs.authorization' : 'pgfs.decline', user_notified: true, memo: memo || (approved ? 'Approved' : 'Declined') },
    response: { code: approved ? '0000' : '1001', memo: approved ? 'Success' : 'Declined' }
});
import { createTransaction } from '@/lib/actions/transaction.actions';
import { getTransactionControls } from '@/lib/actions/transaction-controls.actions';
import { formatUser } from '@/lib/utils';
import type { JitFundingRequest } from '@/lib/types';

/**
 * Webhook JIT (Just-In-Time) Funding.
 * Souveraineté : CashPay contrôle l'argent en temps réel.
 * Marqeta envoie une requête Gateway JIT Funding lorsqu'une transaction est initiée.
 * Cette version enrichie traite les données marchandes (MCC) et les contrôles utilisateurs.
 */
export async function POST(request: NextRequest) {
    const signature = request.headers.get('x-marqeta-signature');

    try {
        const bodyText = await request.text();

        if (!verifyLegacyCardWebhook(bodyText, signature)) return new NextResponse('Unauthorized', { status: 401 });

        const body: JitFundingRequest = JSON.parse(bodyText);
        const jit = body.jit_funding;

        // Si ce n'est pas un message JIT, on ignore
        if (!jit || !jit.token) {
            return NextResponse.json({ success: true });
        }

        const { user_token, amount, currency_code, token: jitToken } = jit;
        if (!Number.isFinite(amount) || amount <= 0 || !['USD', 'EUR'].includes(currency_code) || !body.card_token || !jitToken) return new NextResponse('Invalid funding request', { status: 400 });
        const method = body.method; // e.g. "pgfs.authorization"
        const merchant = body.merchant;

        const connection = await db.getConnection();
        try {
            await connection.query('BEGIN');

            // 2. Identifier l'utilisateur et la carte CashPay
            const { rows: cardRows } = await connection.query(`
                SELECT c.*, u.id as user_real_id, u.country as user_country
                FROM cards c
                JOIN users u ON c.user_id = u.id
                WHERE c.marqeta_card_token = $1 AND c.card_provider_id IS NULL AND c.status = 'active' AND LOWER(u.status) = 'active' LIMIT 1
            `, [body.card_token]);

            if (cardRows.length === 0) throw new Error("Carte non reconnue par CashPay.");
            const cardData = cardRows[0];
            if (String(cardData.currency).toUpperCase() !== currency_code) throw new Error('Devise de carte incompatible.');
            await connection.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`legacy-jit:${jitToken}`]);
            const { rows: previous } = await connection.query("SELECT amount, currency, metadata FROM transactions WHERE metadata->>'jit_token' = $1 AND status = 'Completed'", [jitToken]);
            if (method === 'pgfs.authorization' && previous.length) {
                if (previous.length !== 1 || Number(previous[0].amount) !== amount || previous[0].currency !== currency_code || previous[0].metadata?.card_token !== body.card_token) throw new Error('Identifiant déjà utilisé avec un autre paiement.');
                await connection.query('COMMIT');
                return NextResponse.json(formatJitResponse(jitToken, true, amount));
            }

            // 3. Traiter uniquement les demandes d'autorisation
            if (method === 'pgfs.authorization') {
                // A. Vérifier les contrôles de transaction définis par l'utilisateur
                const controls = await getTransactionControls(cardData.id.toString());

                for (const control of controls) {
                    // Blocage par type de transaction
                    if (control.control_type === 'ECOMMERCE' && control.is_blocked && !body.local_amount) {
                         throw new Error("Achats en ligne bloqués par l'utilisateur.");
                    }
                    // Blocage par catégorie marchande (MCC)
                    if (control.control_type === 'MERCHANT_CATEGORY' && control.is_blocked && control.mcc === merchant.mcc) {
                        throw new Error(`Catégorie marchande ${merchant.mcc} bloquée par l'utilisateur.`);
                    }
                    // Limite par transaction
                    if (control.control_type === 'VELOCITY_LIMIT' && control.window === 'TRANSACTION' && amount > (control.limit_value || Infinity)) {
                        throw new Error("Plafond par transaction dépassé.");
                    }
                }

                // B. Vérifier le solde réel dans le portefeuille CashPay
                const { rows: walletRows } = await connection.query('SELECT balances FROM wallets WHERE user_id = $1 FOR UPDATE', [cardData.user_real_id]);
                const balances = walletRows[0]?.balances || {};
                const availableBalance = parseFloat(balances[currency_code] || '0');

                if (availableBalance >= amount) {
                    // 4. Débit immédiat du portefeuille CashPay
                    const txResult = await createTransaction({
                        user: { id: cardData.user_real_id, country: cardData.user_country } as any,
                        typeCode: 'CARD_PAY',
                        amount,
                        currency: currency_code,
                        description: `Paiement Carte: ${merchant.name} (${merchant.city})`,
                        metadata: {
                            marqeta_token: body.token,
                            jit_token: jitToken,
                            card_token: body.card_token,
                            mcc: merchant.mcc,
                            local_currency: body.local_currency_code,
                            local_amount: body.local_amount
                        },
                        status: 'Completed',
                        connection
                    });

                    if (!txResult.success) throw new Error("Échec du débit local du portefeuille.");

                    await connection.query('COMMIT');

                    console.log(`[JIT] Approved: ${amount} ${currency_code} at ${merchant.name}`);
                    return NextResponse.json(formatJitResponse(jitToken, true, amount));
                } else {
                    throw new Error("Solde CashPay insuffisant.");
                }
            } else if (method === 'pgfs.clearing') {
                // Mise à jour du statut final lors du clearing
                await connection.query(
                    "UPDATE transactions SET status = 'Completed' WHERE metadata->>'marqeta_token' = $1",
                    [body.token]
                );
                await connection.query('COMMIT');
                return NextResponse.json({ success: true });
            }

            await connection.query('ROLLBACK');
            return NextResponse.json({ success: true });

        } catch (dbError: any) {
            if (connection) await connection.query('ROLLBACK');
            console.warn(`[JIT] Declined: ${merchant.name} - ${dbError.message}`);
            return NextResponse.json(formatJitResponse(jitToken, false, 0, dbError.message));
        } finally {
            if (connection) connection.release();
        }
    } catch (error) {
        console.error('[JIT Webhook] Error:', error);
        return new NextResponse('Bad Request', { status: 400 });
    }
}
