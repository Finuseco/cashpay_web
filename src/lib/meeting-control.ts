import { db } from '@/lib/db';
import { MeetingAccessError } from '@/lib/meeting-access';
export async function controlMeeting(code: string, userId: number, action: 'speech' | 'hand' | 'end', targetUserId?: number, enabled = false) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows } = await connection.query('SELECT id, host_user_id, status FROM meetings WHERE meeting_provider_id = $1 FOR UPDATE', [code]);
        const meeting = rows[0];
        if (!meeting || meeting.status !== 'active') throw new MeetingAccessError(404, 'MEET_NOT_FOUND', 'Réunion introuvable ou terminée.');
        if (action !== 'hand' && Number(meeting.host_user_id) !== userId) throw new MeetingAccessError(403, 'HOST_REQUIRED', 'Action réservée à l’organisateur.');
        if (action === 'end') {
            await connection.query("UPDATE meetings SET status = 'ended' WHERE id = $1", [meeting.id]);
            await connection.query('UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = $1 AND left_at IS NULL', [meeting.id]);
        } else {
            if (action === 'speech' && Number(targetUserId) === Number(meeting.host_user_id)) throw new MeetingAccessError(400, 'HOST_ROLE', 'Le rôle de l’organisateur ne peut pas être modifié.');
            const updated = action === 'speech'
                ? await connection.query("UPDATE meeting_participants SET can_speak = $1, role = $2, raise_hand = FALSE WHERE meeting_id = $3 AND user_id = $4 AND left_at IS NULL RETURNING id", [enabled, enabled ? 'speaker' : 'viewer', meeting.id, targetUserId])
                : await connection.query('UPDATE meeting_participants SET raise_hand = $1 WHERE meeting_id = $2 AND user_id = $3 AND left_at IS NULL RETURNING id', [enabled, meeting.id, userId]);
            if (!updated.rows.length) throw new MeetingAccessError(404, 'PARTICIPANT_NOT_FOUND', 'Participant actif introuvable.');
        }
        await connection.query("SELECT pg_notify('onchat_meetings', $1)", [JSON.stringify({ meetCode: code })]);
        await connection.query('COMMIT');
        return { success: true };
    } catch (error) { await connection.query('ROLLBACK'); throw error; }
    finally { connection.release(); }
}
