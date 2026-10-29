import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
export const dynamic = 'force-dynamic';
/** Publish a verified ledger receipt, never execute/retry a financial operation. */
export async function POST(request: NextRequest, { params }: { params: { conversationId: string } }) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
    const connection = await db.getConnection();
    try {
        const { reference } = await request.json();
        if (typeof reference !== 'string' || !reference.trim() || reference.length > 150) return NextResponse.json({ success: false, error: 'Référence invalide.' }, { status: 400 });
        const { rows: members } = await connection.query('SELECT user_id FROM conversation_participants WHERE conversation_id = $1', [params.conversationId]);
        if (members.length !== 2 || !members.some(row => Number(row.user_id) === Number(user.id))) return NextResponse.json({ success: false, error: 'Conversation inaccessible.' }, { status: 403 });
        const receiverId = Number(members.find(row => Number(row.user_id) !== Number(user.id))?.user_id);
        const { rows: transactions } = await connection.query("SELECT id, reference_code, amount, currency, fee, status FROM transactions WHERE reference_code = $1 AND sender_id = $2 AND receiver_id = $3 AND status = 'Completed' AND type_code IN ('TR', 'WD_CRYPTO_MONEY')", [reference, user.id, receiverId]);
        const transaction = transactions[0];
        if (!transaction) return NextResponse.json({ success: false, error: 'Transfert confirmé introuvable pour ce contact.' }, { status: 404 });
        const id = `transfer_${transaction.id}_${params.conversationId}`;
        const metadata = { amount: String(transaction.amount), currency: transaction.currency, fee: String(transaction.fee), reference: transaction.reference_code, transactionStatus: transaction.status };
        await connection.query('BEGIN');
        const { rows } = await connection.query(`INSERT INTO messages(id, conversation_id, sender_id, content, type, status, metadata, is_read) VALUES ($1,$2,$3,$4,'in_chat_transfer','sent',$5::jsonb,FALSE) ON CONFLICT (id) DO UPDATE SET id = messages.id RETURNING *`, [id, params.conversationId, user.id, `Transfert de ${transaction.amount} ${transaction.currency}`, JSON.stringify(metadata)]);
        await connection.query("SELECT pg_notify('onchat_messages', $1)", [JSON.stringify({ id })]);
        await connection.query('COMMIT');
        const message = rows[0];
        return NextResponse.json({ success: true, message: { ...message, senderId: message.sender_id, createdAt: message.created_at } });
    } catch (error) {
        await connection.query('ROLLBACK');
        console.error('[ONCHAT_TRANSFER_RECEIPT]', error);
        return NextResponse.json({ success: false, error: 'Paiement conservé. Reçu temporairement indisponible ; ne renvoyez pas le paiement.' }, { status: 503 });
    } finally { connection.release(); }
}
