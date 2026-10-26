/**
 * POST /api/v1/meetings/create
 * Crée une réunion OnChat. Utilisable depuis Android/iOS/Web.
 *
 * Body JSON :
 *   topic?         : string           — Sujet (max 120 car.)
 *   type?          : "audio" | "video"  (défaut : "video")
 *   scheduledAt?   : ISO string       — Date/heure de début prévue
 *   durationMin?   : number           — Durée prévue en minutes (0 = illimitée)
 *   priceAmount?   : number           — Tarif d'entrée (0 = gratuit)
 *   priceCurrency? : string           — Devise du tarif
 *
 * Réponse :
 *   { success, meetCode, joinUrl, topic, type, scheduledAt, durationMin }
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createOpenMeeting } from '@/lib/actions/meeting.actions';

export const dynamic = 'force-dynamic';

async function ensureSchedulingColumns() {
    await db.query(`
        ALTER TABLE meetings
            ADD COLUMN IF NOT EXISTS scheduled_at   TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS duration_min   INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS price_amount   NUMERIC(18,8) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS price_currency VARCHAR(10)   DEFAULT 'USD'
    `).catch(() => {});
}

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        }

        let body: any = {};
        try { body = await request.json(); } catch { /* body vide */ }

        const type          = body.type === 'audio' ? 'audio' : 'video';
        const topic         = String(body.topic || '').trim().slice(0, 120) || undefined;
        const scheduledAt   = body.scheduledAt ? new Date(body.scheduledAt) : null;
        const durationMin   = Math.max(0, parseInt(body.durationMin ?? '0', 10) || 0);
        const priceAmount   = Math.max(0, Number(body.priceAmount || 0));
        const priceCurrency = String(body.priceCurrency || 'USD').toUpperCase().slice(0, 10);

        const result = await createOpenMeeting({ topic, type });
        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

        // Persist optional scheduling + billing
        if (scheduledAt || durationMin > 0 || priceAmount > 0) {
            await ensureSchedulingColumns();
            await db.query(
                `UPDATE meetings
                 SET scheduled_at = $1, duration_min = $2,
                     price_amount = $3, price_currency = $4
                 WHERE meeting_provider_id = $5`,
                [
                    scheduledAt && !isNaN(scheduledAt.getTime()) ? scheduledAt.toISOString() : null,
                    durationMin,
                    priceAmount,
                    priceCurrency,
                    result.meetCode,
                ]
            ).catch(() => {});
        }

        return NextResponse.json({
            success: true,
            meetCode: result.meetCode,
            joinUrl: result.joinUrl,
            topic: topic || `Réunion de ${user.first_name || user.full_name}`,
            type,
            scheduledAt: scheduledAt && !isNaN(scheduledAt.getTime()) ? scheduledAt.toISOString() : null,
            durationMin,
            billing: { priceAmount, priceCurrency, isPaid: priceAmount > 0 },
        });
    } catch (error: any) {
        console.error('[POST /api/v1/meetings/create]', error?.message);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
