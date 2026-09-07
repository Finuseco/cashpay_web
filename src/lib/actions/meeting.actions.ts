
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { createTransaction } from './transaction.actions';
import { verifyCurrentUserPin } from './auth.actions';
import { formatUser } from '@/lib/utils';
import { sendEmail } from '@/services/email';
import crypto from 'crypto';

/**
 * @fileOverview Moteur de réunion OnChat Meet.
 * Gère la persistance des sessions et la signalisation WebRTC.
 */

/**
 * Crée une nouvelle session de réunion et envoie les invitations.
 */
export async function createMeetingSession(args: {
    hostId: number;
    contactId: number;
    topic: string;
    type: 'audio' | 'video';
}) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // Génération d'un ID de réunion type "xxx-yyyy-zzz"
        const meetCode = `${crypto.randomBytes(3).toString('hex')}-${crypto.randomBytes(3).toString('hex')}-${crypto.randomBytes(3).toString('hex')}`;
        const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL}/feedback/meet/${meetCode}`;

        // 1. Enregistrer la réunion
        const { rows } = await connection.query(
            `INSERT INTO meetings (host_user_id, topic, meeting_provider_id, join_url, type, status)
             VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
            [args.hostId, args.topic, meetCode, joinUrl, args.type]
        );
        const meetingId = rows[0].id;

        // 2. Récupérer les infos pour l'invitation
        const { rows: users } = await connection.query(
            'SELECT id, full_name, email, first_name FROM users WHERE id IN ($1, $2)',
            [args.hostId, args.contactId]
        );
        
        const host = users.find(u => u.id === args.hostId) || { full_name: 'Un utilisateur', first_name: 'Un utilisateur' };
        const guest = users.find(u => u.id === args.contactId);

        // 3. Envoyer l'invitation par email
        if (guest?.email) {
            await sendEmail(guest.email, `Invitation Meet : ${args.topic}`, 'general', {
                title: 'Nouvelle Invitation Vidéo',
                greeting: `Bonjour ${guest.first_name || guest.full_name},`,
                message: `<strong>${host.full_name}</strong> vous invite à rejoindre une réunion vidéo sur OnChat.<br/>Sujet : <strong>${args.topic}</strong>`,
                buttonText: 'Rejoindre la réunion',
                buttonUrl: joinUrl,
                signature: "Infrastructure Souveraine OnChat"
            }).catch(console.error);
        }

        await connection.query('COMMIT');
        return { success: true, meetCode, joinUrl, meetingId };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        console.error("[createMeetingSession] Error:", error.message);
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

/**
 * Signalisation WebRTC : Envoie une offre, une réponse ou un candidat ICE via la DB.
 */
export async function sendMeetSignal(meetCode: string, senderId: number, signalData: any) {
    try {
        await db.query(
            `INSERT INTO meeting_signals (meeting_id, sender_id, signal_data)
             VALUES ((SELECT id FROM meetings WHERE meeting_provider_id = $1 LIMIT 1), $2, $3)`,
            [meetCode, senderId, JSON.stringify(signalData)]
        );
        return { success: true };
    } catch (e) {
        return { success: false };
    }
}

/**
 * Signalisation WebRTC : Récupère les nouveaux signaux non consommés.
 */
export async function getMeetSignals(meetCode: string, userId: number) {
    try {
        const { rows } = await db.query(
            `SELECT ms.* FROM meeting_signals ms
             JOIN meetings m ON ms.meeting_id = m.id
             WHERE m.meeting_provider_id = $1 AND ms.sender_id != $2 AND ms.consumed = false
             ORDER BY ms.created_at ASC`,
            [meetCode, userId]
        );
        
        if (rows.length > 0) {
            const ids = rows.map(r => r.id);
            await db.query('UPDATE meeting_signals SET consumed = true WHERE id = ANY($1::int[])', [ids]);
        }

        return rows.map(r => JSON.parse(r.signal_data));
    } catch (e) {
        return [];
    }
}

export async function getMeetingByCode(meetCode: string) {
    try {
        const { rows } = await db.query(
            "SELECT * FROM meetings WHERE meeting_provider_id = $1 AND status = 'active'",
            [meetCode]
        );
        return rows[0] || null;
    } catch (e) {
        return null;
    }
}
