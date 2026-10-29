import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
export const dynamic = 'force-dynamic';
/** Read-only quote for an existing two-person chat. Never invokes the transfer endpoint. */
export async function POST(request: NextRequest, { params }: { params: { conversationId: string } }) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
    let connection;
    try {
        const body = await request.json();
        const currency = String(body.currency || '').toUpperCase();
        const amount = Number(body.amount);
        const decimals = currency === 'BTC' ? 8 : 6;
        if (!['BTC', 'USDT'].includes(currency) || !Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 10 ** decimals - Math.round(amount * 10 ** decimals)) > 0.00001) return NextResponse.json({ success: false, error: 'Montant ou devise crypto invalide.' }, { status: 400 });
        connection = await db.getConnection();
        const { rows: members } = await connection.query('SELECT user_id FROM conversation_participants WHERE conversation_id = $1', [params.conversationId]);
        if (members.length !== 2 || !members.some(row => Number(row.user_id) === Number(user.id))) return NextResponse.json({ success: false, error: 'Conversation inaccessible.' }, { status: 403 });
        const receiverId = Number(members.find(row => Number(row.user_id) !== Number(user.id))?.user_id);
        const asset = currency === 'USDT' ? 'USDT_TRC20' : 'BTC';
        const { rows: addresses } = await connection.query('SELECT address FROM user_crypto_addresses WHERE user_id = $1 AND currency_code = $2 ORDER BY id DESC LIMIT 1', [receiverId, asset]);
        if (!addresses[0]?.address) return NextResponse.json({ success: false, error: `Le destinataire doit activer son adresse ${currency}.` }, { status: 422 });
        const { rows: balances } = await connection.query('SELECT balance FROM user_crypto_balances WHERE user_id = $1 AND currency_code = $2', [user.id, asset]);
        const balance = Number(balances[0]?.balance || 0);
        const fee = Number(await calculateTransactionFee(amount, currency, 'WD_CRYPTO_MONEY', user.country, connection));
        if (!Number.isFinite(fee) || fee < 0 || !Number.isFinite(balance)) throw new Error('Calcul des frais indisponible.');
        const totalDebit = amount + fee;
        if (balance < totalDebit) return NextResponse.json({ success: false, error: `Solde ${currency} insuffisant (montant + frais).`, balance, totalDebit }, { status: 422 });
        return NextResponse.json({ success: true, preview: true, amount, currency, fee, totalDebit, balance, recipientAddress: addresses[0].address });
    } catch (error) {
        console.error('[ONCHAT_CRYPTO_QUOTE]', error);
        return NextResponse.json({ success: false, error: 'Devis crypto indisponible.' }, { status: 503 });
    } finally { connection?.release(); }
}
