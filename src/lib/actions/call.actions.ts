

'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { User, Call } from '@/lib/types';

/** Type d'appel : audio ou vidéo */
export type CallType = 'audio' | 'video';

/**
 * Initie un appel 1-on-1 :
 * 1. Crée une réunion Meet pour générer le lien de rejoindre
 * 2. Enregistre l'appel dans call_logs
 * Retourne { success, callId, inviteLink }
 */
export async function initiateCall(args: {
    callerId: number;
    receiverId: number;
    type: CallType;
}): Promise<{ success: boolean; callId?: string; inviteLink?: string; error?: string }> {
    try {
        const { createOpenMeeting } = await import('./meeting.actions');
        const { getAuthenticatedUser } = await import('./user.actions');

        const host = await getAuthenticatedUser();
        if (!host) return { success: false, error: 'Authentification requise.' };

        // Créer la réunion Meet pour avoir un lien
        const meeting = await createOpenMeeting({ type: args.type });
        if (!meeting.success) return { success: false, error: meeting.error };

        const callId = `call_${meeting.meetCode}`;

        // Enregistrer dans call_logs
        await db.query(
            `INSERT INTO call_logs (id, caller_id, receiver_id, is_video, status, duration_seconds, started_at)
             VALUES ($1, $2, $3, $4, 'MISSED', 0, NOW())
             ON CONFLICT (id) DO NOTHING`,
            [callId, args.callerId, args.receiverId, args.type === 'video']
        );

        return { success: true, callId, inviteLink: meeting.joinUrl };
    } catch (error: any) {
        console.error('[initiateCall]', error?.message);
        return { success: false, error: "Impossible d'initier l'appel." };
    }
}

/**
 * Logs the start of a new call session.
 */
export async function startCallSession(call: Call): Promise<{ success: boolean; sessionId?: number }> {
    try {
        const sessionData = {
            session_uuid: call.id,
            initiator_user_id: call.caller.id,
            type: call.type,
            status: 'ringing',
            start_time: new Date(),
        };
        
        const { rows } = await db.query('INSERT INTO call_sessions (session_uuid, initiator_user_id, type, status, start_time) VALUES ($1, $2, $3, $4, $5) RETURNING id', Object.values(sessionData));
        const sessionId = rows[0].id;

        // Add caller and callee as participants
        await db.query('INSERT INTO call_participants (session_id, user_id) VALUES ($1, $2), ($1, $3)', [sessionId, call.caller.id, call.callee.id]);

        return { success: true, sessionId };
    } catch (error) {
        const dbError = await handleDbError(error, 'starting call session');
        console.error(dbError.error);
        return { success: false };
    }
}

/**
 * Logs the end of a call session and updates its status.
 */
export async function endCallSession(sessionId: number, status: Call['status']): Promise<{ success: boolean }> {
    try {
        await db.query('UPDATE call_sessions SET status = $1, end_time = NOW() WHERE id = $2', [status, sessionId]);
        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'ending call session');
        console.error(dbError.error);
        return { success: false };
    }
}


/**
 * Fetches the call history for the admin dashboard.
 */
export async function getCallHistory(limit: number = 100): Promise<any[]> {
    try {
        const query = `
            SELECT 
                cs.session_uuid as id,
                cs.initiator_user_id,
                u.full_name as initiator_name,
                cs.type,
                cs.status,
                cs.start_time,
                cs.end_time,
                (SELECT COUNT(*) FROM call_participants WHERE session_id = cs.id) as participant_count,
                cs.billed_amount,
                cs.currency
            FROM call_sessions cs
            JOIN users u ON cs.initiator_user_id = u.id
            ORDER BY cs.start_time DESC
            LIMIT $1
        `;
        const { rows } = await db.query(query, [limit]);
        return rows;
    } catch (error) {
        await handleDbError(error, 'fetching call history');
        return [];
    }
}
