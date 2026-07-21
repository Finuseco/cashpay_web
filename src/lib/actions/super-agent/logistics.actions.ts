
'use server';

import { db } from '@/lib/db';
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
    try {
        const { rows } = await db.query(`
            SELECT cr.*, cr.created_at as "createdAt", u.full_name, u.id_wallet, u.phone 
            FROM card_requests cr 
            JOIN users u ON cr.user_id = u.id 
            WHERE u.country = $1 
            ORDER BY cr.created_at DESC
        `, [countryName]);
        return rows;
    } catch (e) { return []; }
}

/**
 * Récupère les cartes d'un utilisateur pour l'administration.
 */
export async function getUserCardsForAdmin(userId: number) {
    try {
        const { rows } = await db.query(`
            SELECT * FROM cards 
            WHERE user_id = $1 AND status != 'cancelled'
            ORDER BY created_at DESC
        `, [userId]);
        return rows;
    } catch (error) {
        console.error("[getUserCardsForAdmin] Error:", error);
        return [];
    }
}

/**
 * Commande une carte pour un client et envoie les notifications.
 */
export async function orderCardForClient(args: { adminId: number, targetUserId: number, cardType: 'virtuelle' | 'physique', brand: 'visa' | 'mastercard', currency: string, adminPin: string }) {
    const { adminId, targetUserId, cardType, brand, currency, adminPin } = args;
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const pinMatch = await verifyUserPin(adminId, adminPin);
        if (!pinMatch.success) throw new Error("PIN Super Agent incorrect.");

        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [targetUserId]);
        if (userRows.length === 0) throw new Error("Client non trouvé.");
        const user = formatUser(userRows[0]);

        const feeCode = `BUY_CARDS_${currency.toUpperCase()}_${cardType === 'virtuelle' ? 'V' : 'P'}_FEE`;
        const fee = await calculateTransactionFee(1, currency, feeCode, user.country, connection);

        const tx = await createTransaction({
            user, typeCode: feeCode, amount: fee, currency,
            description: `Commande carte ${cardType} ${brand.toUpperCase()} (via Agent)`,
            metadata: { facilitator: adminId }, connection
        });

        if (!tx.success) throw new Error(tx.error);

        if (cardType === 'virtuelle') {
            const cardToken = `vcard_${Math.random().toString(36).substring(7)}`;
            await connection.query(`
                INSERT INTO cards (user_id, marqeta_card_token, card_type, brand, currency, status, last4)
                VALUES ($1, $2, 'virtuelle', $3, $4, 'active', $5)`,
                [user.id, cardToken, brand, currency, '1234']
            );
        } else {
            await connection.query('INSERT INTO card_requests (user_id, card_type, brand, currency, status) VALUES ($1, $2, $3, $4, $5)', 
                [user.id, 'physique', brand, currency, 'pending']);
        }

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
        const { rows: reqRows } = await connection.query('SELECT user_id, brand, currency FROM card_requests WHERE id = $1', [requestId]);
        if (reqRows.length === 0) throw new Error("Demande introuvable.");
        const req = reqRows[0];

        await connection.query("UPDATE card_requests SET status = 'completed', processed_at = NOW() WHERE id = $1", [requestId]);
        await connection.query(`
            INSERT INTO cards (user_id, marqeta_card_token, card_type, brand, currency, status, last4)
            VALUES ($1, $2, 'physique', $3, $4, 'active', $5)
        `, [req.user_id, cardToken, req.brand, req.currency, cardToken.slice(-4)]);

        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally { connection.release(); }
}

export async function orderBulkStock(quantity: number, brand: string) {
    try {
        await db.query("INSERT INTO card_bulk_orders (quantity, brand, status) VALUES ($1, $2, 'pending_approval')", [quantity, brand]);
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getBulkOrders() {
    try {
        const { rows } = await db.query("SELECT * FROM card_bulk_orders ORDER BY created_at DESC LIMIT 50");
        return { success: true, localRequests: rows };
    } catch (e) { return { success: false, localRequests: [] }; }
}

export async function getCountryOrders(countryName: string) {
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
        WHERE u.country = $1 ORDER BY o.created_at DESC LIMIT 100
    `, [countryName]);
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
        const user = formatUser(request);

        const feeCode = `BUY_CARDS_${request.currency.toUpperCase()}_P_FEE`;
        const refundAmount = await calculateTransactionFee(1, request.currency, feeCode, user.country, connection);

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
    const { rows: transactions } = await db.query(`
        SELECT t.*, u.full_name, c.brand, c.last4
        FROM transactions t
        JOIN users u ON t.sender_id = u.id
        JOIN cards c ON t.metadata->>'card_token' = c.marqeta_card_token
        WHERE u.country = $1 AND t.type_code = 'CARD_PAY'
        ORDER BY t.created_at DESC LIMIT 50
    `, [countryName]);

    const { rows: stats } = await db.query(`
        SELECT currency, brand, SUM(amount) as total
        FROM transactions t
        JOIN users u ON t.sender_id = u.id
        JOIN cards c ON t.metadata->>'card_token' = c.marqeta_card_token
        WHERE u.country = $1 AND t.type_code = 'CARD_PAY' AND t.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY currency, brand
    `, [countryName]);

    return { transactions, stats };
}
