
'use server';

import { db } from '@/lib/db';
import { regionalScope, requireSuperAgent, assertManagedUser } from '@/lib/super-agent-access';
import { handleDbError, saveBase64Image } from '../helpers';
import { createTransaction } from '../transaction.actions';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { formatUser, countryToCode } from '@/lib/utils';
import { calculateTransactionFee } from '../wallet.actions';
import { verifyUserPin } from '../auth.actions';
import { logIntervention } from './utils';
import { generateReferenceCode } from '@/lib/utils';

export async function getCountryCardRequests(countryName: string) {
    const scope = await regionalScope(countryName);
    try {
        const { rows } = await db.query(`
            SELECT cr.*, cr.created_at as "createdAt", u.full_name, u.id_wallet, u.phone
            FROM card_requests cr
            JOIN users u ON cr.user_id = u.id
            WHERE ${scope.sql}
            ORDER BY cr.created_at DESC
        `, scope.values);
        return rows;
    } catch (e) { throw new Error('Données indisponibles. Réessayez après vérification de la base.'); }
}

/**
 * Récupère les cartes d'un utilisateur pour l'administration.
 */
export async function getUserCardsForAdmin(userId: number) {
    const actor = await requireSuperAgent();
    await assertManagedUser(actor.id, userId);
    try {
        const { rows } = await db.query(`
            SELECT * FROM cards
            WHERE user_id = $1 AND status != 'cancelled'
            ORDER BY created_at DESC
        `, [userId]);
        return rows;
    } catch (error) {
        console.error("[getUserCardsForAdmin] Error:", error);
        throw new Error('Données indisponibles. Réessayez après vérification de la base.');
    }
}

/**
 * Commande une carte pour un client et envoie les notifications.
 */
export async function orderCardForClient(args: { adminId: number, targetUserId: number, cardType: 'virtuelle' | 'physique', brand: 'visa' | 'mastercard', currency: string, adminPin: string }) {
    const { adminId, targetUserId, cardType, brand, adminPin } = args;
    const currency = String(args.currency).toUpperCase();
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        await assertManagedUser(adminId, targetUserId, connection);
        if (!['physique', 'virtuelle'].includes(cardType) || !['visa', 'mastercard'].includes(brand) || !['USD', 'EUR'].includes(currency.toUpperCase())) throw new Error('Produit de carte invalide.');
        if (cardType === 'virtuelle') throw new Error('Émission virtuelle déléguée non disponible : utilisez le parcours FYATU vérifié du titulaire. Aucune carte fictive ne sera créée.');
        const pinMatch = await verifyUserPin(adminId, adminPin);
        if (!pinMatch.success) throw new Error("PIN Super Agent incorrect.");

        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [targetUserId]);
        if (userRows.length === 0) throw new Error("Client non trouvé.");
        const user = formatUser(userRows[0]);

        const feeCode = `BUY_CARDS_${currency.toUpperCase()}_P_FEE`;
        const fee = await calculateTransactionFee(1, currency, feeCode, user.country, connection);

        const tx = await createTransaction({
            user, typeCode: feeCode, amount: fee, currency,
            description: `Commande carte ${cardType} ${brand.toUpperCase()} (via Agent)`,
            metadata: { facilitator: adminId }, connection
        });

        if (!tx.success) throw new Error(tx.error);

        const { rows: requests } = await connection.query('INSERT INTO card_requests (user_id, card_type, brand, currency, status) VALUES ($1, $2, $3, $4, $5) RETURNING id', [user.id, 'physique', brand, currency.toUpperCase(), 'pending']);
        await connection.query("UPDATE transactions SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('card_request_id', $1::int) WHERE id = $2", [requests[0].id, tx.transactionId]);

        await logIntervention(adminId, user.id, 'CARD_ORDER', `Commande de carte ${cardType} ${brand.toUpperCase()}`, connection);

        await connection.query('COMMIT');

        const msg = `CashPay: Votre carte ${brand.toUpperCase()} ${currency} (${cardType}) a été commandée par votre agent. Consultez votre espace client.`;
        if (user.phone) await sendSms(user.phone, msg).catch(console.error);
        if (user.email) {
            await sendEmail(user.email, `Nouvelle carte CashPay : ${brand.toUpperCase()}`, 'general', {
                title: "Commande de Carte Confirmée",
                greeting: `Bonjour ${user.first_name},`,
                message: `Une carte <strong>${brand.toUpperCase()} ${currency}</strong> de type <strong>${cardType}</strong> a été commandée pour vous par votre Super Agent.`,
                buttonText: 'Gérer mes cartes',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/cards`,
                signature: "L'équipe de Soutien CashPay"
            }).catch(console.error);
        }

        return { success: true };
    } catch (e: any) {
        if (connection) await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        if (connection) connection.release();
    }
}

export async function assignAndDeliverCard(requestId: number, cardToken: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const actor = await requireSuperAgent(undefined, connection);
        const { rows: reqRows } = await connection.query('SELECT user_id, brand, currency, status FROM card_requests WHERE id = $1 FOR UPDATE', [requestId]);
        if (reqRows.length === 0) throw new Error("Demande introuvable.");
        const req = reqRows[0];

        await assertManagedUser(actor.id, req.user_id, connection);
        throw new Error('Livraison suspendue : la validation de propriété d’une carte physique FYATU doit être confirmée par le fournisseur. Aucun numéro fictif ne sera affecté.');
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}

export async function orderBulkStock(quantity: number, brand: string) {
    try {
        const actor = await requireSuperAgent();
        if (actor.role !== 'Admin') throw new Error('Stock global réservé au siège.');
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000 || !['visa', 'mastercard'].includes(brand)) throw new Error('Commande invalide.');
        await db.query("INSERT INTO card_bulk_orders (quantity, brand, status) VALUES ($1, $2, 'pending_approval')", [quantity, brand]);
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getBulkOrders() {
    try {
        const actor = await requireSuperAgent();
        if (actor.role !== 'Admin') throw new Error('Stock global réservé au siège.');
        const { rows } = await db.query("SELECT * FROM card_bulk_orders ORDER BY created_at DESC LIMIT 50");
        return { success: true, localRequests: rows };
    } catch (e) { return { success: false, localRequests: [] }; }
}

export async function getCountryOrders(countryName: string) {
    const scope = await regionalScope(countryName);
    const { rows } = await db.query(`
        SELECT
            o.id, o.reference, o.total_amount as "totalPrice", o.status,
            o.created_at as "createdAt", o.currency,
            u.full_name as "buyerName", p.name as "productName", seller.full_name as "sellerName"
        FROM orders o
        JOIN users u ON o.user_id = u.id
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        JOIN users seller ON p.agent_id = seller.id
        WHERE ${scope.sql} ORDER BY o.created_at DESC LIMIT 100
    `, scope.values);
    return rows.map(r => ({ ...r, seller: { name: r.sellerName } }));
}

export async function cancelCardOrderAndRefund(requestId: number, adminId: number, reason: string) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: reqRows } = await connection.query(`
            SELECT cr.*, u.id as user_id, u.full_name, u.country, u.id_wallet
            FROM card_requests cr
            JOIN users u ON cr.user_id = u.id
            WHERE cr.id = $1 AND cr.status = 'pending' FOR UPDATE
        `, [requestId]);

        if (reqRows.length === 0) throw new Error("Commande de carte non trouvée ou déjà traitée.");
        const request = reqRows[0];
        await assertManagedUser(adminId, request.user_id, connection);
        if (!reason?.trim() || reason.trim().length < 10) throw new Error('Motif détaillé requis.');
        const user = formatUser({ ...request, id: request.user_id });

        const feeCode = `BUY_CARDS_${request.currency.toUpperCase()}_P_FEE`;
        const { rows: charges } = await connection.query("SELECT id, amount, currency FROM transactions WHERE sender_id = $1 AND type_code = $2 AND status = 'Completed' AND metadata->>'card_request_id' = $3 FOR UPDATE", [request.user_id, feeCode, String(requestId)]);
        if (charges.length !== 1 || String(charges[0].currency).toUpperCase() !== String(request.currency).toUpperCase()) throw new Error('Paiement original non rapproché. Remboursement automatique refusé.');
        const refundAmount = Number(charges[0].amount);
        if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new Error('Montant original invalide.');

        const txResult = await createTransaction({
            user,
            typeCode: 'RW',
            amount: refundAmount,
            currency: request.currency,
            description: `Remboursement commande carte annulée (Réf: #${requestId})`,
            metadata: { original_request_id: requestId, reason, cancelled_by: adminId },
            status: 'Completed',
            connection
        });

        if (!txResult.success) throw new Error("Échec du remboursement financier.");

        await connection.query("UPDATE card_requests SET status = 'cancelled', processed_at = NOW() WHERE id = $1", [requestId]);
        await logIntervention(adminId, user.id, 'CARD_ORDER_CANCEL', `Annulation et remboursement de ${refundAmount} ${request.currency} (Raison: ${reason})`, connection);

        await connection.query('COMMIT');

        if (user.phone) {
            sendSms(user.phone, `CashPay Alerte: Votre commande de carte a été annulée. Votre compte a été recrédité de ${refundAmount} ${request.currency}.`).catch(console.error);
        }

        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}

export async function getCardActivityFeed(countryName: string) {
    const scope = await regionalScope(countryName);
    const { rows: transactions } = await db.query(`
        SELECT t.*, u.full_name, c.brand, c.last4
        FROM transactions t
        JOIN users u ON t.sender_id = u.id
        JOIN cards c ON t.metadata->>'card_token' = c.marqeta_card_token
        WHERE ${scope.sql} AND t.type_code = 'CARD_PAY'
        ORDER BY t.created_at DESC LIMIT 50
    `, scope.values);

    const { rows: stats } = await db.query(`
        SELECT currency, brand, SUM(amount) as total
        FROM transactions t
        JOIN users u ON t.sender_id = u.id
        JOIN cards c ON t.metadata->>'card_token' = c.marqeta_card_token
        WHERE ${scope.sql} AND t.type_code = 'CARD_PAY' AND t.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY currency, brand
    `, scope.values);

    return { transactions, stats };
}
