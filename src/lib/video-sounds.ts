import { db } from '@/lib/db';
import { VideoPolicyError } from '@/lib/video-policy';
export async function soundForVideo(id: number) {
    const { rows } = await db.query(`SELECT COALESCE(sound.source_media_id, sound.media_id) AS "sourceId", sound.title,
        (COALESCE(root.allow_reuse, FALSE) = TRUE AND m.visibility = 'public' AND m.expires_at > NOW()) AS "allowReuse",
        sound.author_user_id AS "authorId", u.full_name AS "authorName", u.profile_photo AS "authorAvatar",
        CASE WHEN m.visibility = 'public' AND m.expires_at > NOW() THEN COALESCE(m.file_url, 'https://app.cashpay-all.com' || m.file_path, '') ELSE '' END AS url
        FROM onchat_video_sounds sound
        LEFT JOIN onchat_video_sounds root ON root.media_id = COALESCE(sound.source_media_id, sound.media_id)
        LEFT JOIN media m ON m.id = root.media_id JOIN users u ON u.id = sound.author_user_id
        JOIN media target ON target.id = sound.media_id
        WHERE sound.media_id = $1 AND target.visibility = 'public' AND target.expires_at > NOW()`, [id]);
    const sound = rows[0];
    if (sound?.authorAvatar?.startsWith('/')) sound.authorAvatar = `https://app.cashpay-all.com${sound.authorAvatar}`;
    return sound || null;
}
/** Save attribution in the same transaction as publication. Old clients need no sound schema. */
export async function insertPublishedVideo(sql: string, values: unknown[], form: FormData, userId: number) {
    const wantsReuse = form.get('allowSoundReuse') === 'true';
    const sourceValue = form.get('soundSourceId');
    if (!wantsReuse && !sourceValue) return db.query(sql, values);
    const rights = form.get('soundRightsConfirmed') === 'true';
    if (wantsReuse && !rights) throw new VideoPolicyError('Confirmez détenir les droits du son avant d’autoriser sa réutilisation.');
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        let sourceId: number | null = null;
        let authorId = userId;
        let title = String(form.get('soundTitle') || 'Son original').trim().slice(0,160);
        if (sourceValue) {
            const requested = Number(sourceValue);
            if (!Number.isSafeInteger(requested) || requested <= 0) throw new VideoPolicyError('Source audio invalide.');
            const { rows } = await connection.query(`SELECT s.media_id, s.author_user_id, s.title FROM onchat_video_sounds s JOIN media m ON m.id = s.media_id WHERE s.media_id = $1 AND s.source_media_id IS NULL AND s.allow_reuse = TRUE AND m.visibility = 'public' AND m.expires_at > NOW() FOR SHARE OF s, m`, [requested]);
            if (!rows.length) throw new VideoPolicyError('Ce son n’est plus autorisé à la réutilisation.');
            sourceId = requested;
            authorId = Number(rows[0].author_user_id);
            title = rows[0].title;
        }
        const result = await connection.query(sql, values);
        await connection.query(`INSERT INTO onchat_video_sounds(media_id, author_user_id, title, allow_reuse, source_media_id, rights_confirmed_at) VALUES ($1,$2,$3,$4,$5,CASE WHEN $6 THEN NOW() ELSE NULL END)`, [result.rows[0].id, authorId, title, wantsReuse && !sourceId, sourceId, rights]);
        await connection.query('COMMIT');
        return result;
    } catch (error) { await connection.query('ROLLBACK'); throw error; }
    finally { connection.release(); }
}
