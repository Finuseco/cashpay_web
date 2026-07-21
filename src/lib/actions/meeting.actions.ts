
'use server';

/**
 * @fileOverview Gestionnaire de réunions et d'appels monétisés.
 * Gère la création de salons et la facturation automatique des participants.
 */

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { User, Meeting } from '@/lib/types';
import { createTransaction } from './transaction.actions';
import { verifyCurrentUserPin } from './auth.actions';
import { formatUser } from '@/lib/utils';
import type { PoolClient } from 'pg';

interface CreateMeetingArgs {
    hostId: number;
    topic: string;
    agenda?: string;
    type: 'audio' | 'video' | 'meeting';
    entryFee: number;
    currency: string;
}

/**
 * Crée une nouvelle réunion avec un prix d'entrée optionnel.
 */
export async function createMeeting(args: CreateMeetingArgs): Promise<{ success: boolean; meeting?: Meeting; error?: string }> {
    try {
        const meetingId = `meet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const joinUrl = `/feedback/meet/${meetingId}`;

        const payload = {
            host_user_id: args.hostId,
            topic: args.topic,
            agenda: args.agenda || null,
            meeting_provider_id: meetingId,
            join_url: joinUrl,
            type: args.type,
            status: 'pending',
            entry_fee: args.entryFee,
            currency: args.currency
        };

        const { rows } = await db.query(
            `INSERT INTO meetings (host_user_id, topic, agenda, meeting_provider_id, join_url, type, status, entry_fee, currency)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            Object.values(payload)
        );

        return { success: true, meeting: rows[0] as Meeting };
    } catch (error) {
        const dbError = await handleDbError(error, 'creating meeting');
        return { success: false, error: dbError.error };
    }
}

/**
 * Traite l'entrée d'un utilisateur dans une réunion facturée.
 * Débite le participant et crédite l'organisateur AVANT d'autoriser l'accès.
 */
export async function processMeetingEntry(args: {
    participantId: number;
    meetingProviderId: string;
    pin: string;
}): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Vérifier le PIN du participant
        const pinRes = await verifyCurrentUserPin(args.pin);
        if (!pinRes.success) throw new Error("Code PIN incorrect.");

        // 2. Récupérer les détails de la réunion
        const { rows: meetRows } = await connection.query(
            'SELECT * FROM meetings WHERE meeting_provider_id = $1 FOR UPDATE',
            [args.meetingProviderId]
        );
        if (meetRows.length === 0) throw new Error("Réunion introuvable.");
        const meeting = meetRows[0];

        if (meeting.entry_fee <= 0) {
            await connection.query('COMMIT');
            return { success: true };
        }

        // 3. Récupérer le participant
        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [args.participantId]);
        if (userRows.length === 0) throw new Error("Participant introuvable.");
        const participant = formatUser(userRows[0]);

        // 4. Exécuter la transaction de paiement vers l'hôte
        const txResult = await createTransaction({
            user: participant,
            typeCode: 'MEETING_FEE',
            amount: parseFloat(meeting.entry_fee),
            currency: meeting.currency,
            description: `Accès réunion : ${meeting.topic}`,
            receiver_id: meeting.host_user_id,
            metadata: { meetingId: meeting.id },
            connection
        });

        if (!txResult.success) throw new Error(txResult.error || "Solde insuffisant pour accéder à cette réunion.");

        await connection.query('COMMIT');
        return { success: true };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

/**
 * Récupère les réunions actives pour un utilisateur (Hôte ou Invité).
 */
export async function getActiveMeetings(userId: number): Promise<Meeting[]> {
    try {
        const { rows } = await db.query(
            "SELECT * FROM meetings WHERE (host_user_id = $1 OR status = 'active') AND status != 'ended' ORDER BY created_at DESC",
            [userId]
        );
        return rows as Meeting[];
    } catch (error) {
        return [];
    }
}
