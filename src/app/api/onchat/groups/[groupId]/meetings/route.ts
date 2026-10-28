import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
export async function POST(request: Request, { params }: { params: { groupId: string } }) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
    const groupId = Number(params.groupId);
    if (!Number.isSafeInteger(groupId) || groupId <= 0) return NextResponse.json({ success: false, error: 'Groupe invalide.' }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const type = body.type === 'audio' ? 'audio' : 'video';
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows } = await connection.query("SELECT g.id, g.name FROM groups g JOIN group_members gm ON gm.group_id = g.id WHERE g.id = $1 AND gm.user_id = $2 AND gm.status = 'active'", [groupId, user.id]);
        if (!rows[0]) { await connection.query('ROLLBACK'); return NextResponse.json({ success: false, error: 'Groupe inaccessible.' }, { status: 403 }); }
        const meetCode = crypto.randomUUID();
        const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/feedback/meet/${meetCode}`;
        await connection.query("INSERT INTO meetings (host_user_id, topic, meeting_provider_id, join_url, type, status, price_amount, price_currency, group_id) VALUES ($1, $2, $3, $4, $5, 'active', 0, 'USD', $6)", [user.id, rows[0].name, meetCode, joinUrl, type, groupId]);
        const invitation = await connection.query("INSERT INTO group_messages (group_id, sender_id, content, type, metadata) VALUES ($1, $2, $3, 'meeting', $4::jsonb) RETURNING id", [groupId, user.id, joinUrl, JSON.stringify({ meetCode, joinUrl, type })]);
        await connection.query("SELECT pg_notify('onchat_group_messages', $1)", [JSON.stringify({ id: String(invitation.rows[0].id) })]);
        await connection.query('COMMIT');
        return NextResponse.json({ success: true, meetCode, joinUrl, type }, { status: 201 });
    } catch (error) {
        await connection.query('ROLLBACK'); console.error('[Group meeting]', error);
        return NextResponse.json({ success: false, error: 'Création de réunion de groupe indisponible.' }, { status: 503 });
    } finally { connection.release(); }
}
