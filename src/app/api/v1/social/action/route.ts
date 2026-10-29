import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
export async function POST(request: NextRequest) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
    const connection = await db.getConnection();
    try {
        const { userId, action } = await request.json();
        const target = Number(userId);
        if (!Number.isSafeInteger(target) || target <= 0 || target === Number(user.id) || !['follow', 'unfollow'].includes(action)) return NextResponse.json({ success: false, error: 'Action ou destinataire invalide.' }, { status: 400 });
        await connection.query('BEGIN');
        // Serialize operations for this account using the existing user row; no new schema.
        await connection.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
        const exists = await connection.query('SELECT id FROM users WHERE id = $1', [target]);
        if (!exists.rows.length) { await connection.query('ROLLBACK'); return NextResponse.json({ success: false, error: 'Créateur introuvable.' }, { status: 404 }); }
        if (action === 'follow') await connection.query('INSERT INTO user_followers(follower_user_id, followed_user_id) SELECT $1,$2 WHERE NOT EXISTS (SELECT 1 FROM user_followers WHERE follower_user_id = $1 AND followed_user_id = $2)', [user.id, target]);
        else await connection.query('DELETE FROM user_followers WHERE follower_user_id = $1 AND followed_user_id = $2', [user.id, target]);
        const { rows } = await connection.query('SELECT (SELECT COUNT(*) FROM user_followers WHERE followed_user_id = $1) AS followers, (SELECT COUNT(*) FROM user_followers WHERE follower_user_id = $1) AS following', [target]);
        await connection.query('COMMIT');
        return NextResponse.json({ success: true, relation: { following: action === 'follow' }, stats: { followers: Number(rows[0].followers), following: Number(rows[0].following) } });
    } catch (error) {
        await connection.query('ROLLBACK');
        console.error('[ONCHAT_FOLLOW]', error);
        return NextResponse.json({ success: false, error: 'Abonnement non enregistré.' }, { status: 503 });
    } finally { connection.release(); }
}
