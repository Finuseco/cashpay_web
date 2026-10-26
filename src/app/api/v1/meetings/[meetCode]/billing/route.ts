/**
 * GET  /api/v1/meetings/:meetCode/billing
 *   → info de facturation du meeting (prix, devise, créateur)
 *
 * POST /api/v1/meetings/:meetCode/billing
 *   Body: { priceAmount, priceCurrency }
 *   → L'hôte définit ou met à jour le tarif d'entrée (0 = gratuit)
 *   Seul l'hôte peut poster.
 *
 * Les colonnes price_amount / price_currency sont ajoutées automatiquement
 * à la table meetings si elles n'existent pas.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

async function ensureBillingColumns() {
    await db.query(`
        ALTER TABLE meetings
            ADD COLUMN IF NOT EXISTS price_amount   NUMERIC(18,8) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS price_currency VARCHAR(10)   DEFAULT 'USD'
    `).catch(() => {});
}

export async function GET(
    _request: NextRequest,
    { params }: { params: { meetCode: string } }
) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });

        await ensureBillingColumns();
        const { rows } = await db.query(
            `SELECT meeting_provider_id AS meet_code, topic, type, status,
                    COALESCE(price_amount, 0) AS price_amount,
                    COALESCE(price_currency, 'USD') AS price_currency,
                    host_user_id
             FROM meetings WHERE meeting_provider_id = $1 LIMIT 1`,
            [params.meetCode]
        );
        if (!rows[0]) return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });

        const r = rows[0];
        return NextResponse.json({
            success: true,
            meetCode: r.meet_code,
            topic: r.topic,
            type: r.type,
            status: r.status,
            billing: {
                priceAmount: Number(r.price_amount),
                priceCurrency: r.price_currency,
                isPaid: Number(r.price_amount) > 0,
                hostUserId: r.host_user_id,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { meetCode: string } }
) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        const priceAmount   = Math.max(0, Number(body.priceAmount   || 0));
        const priceCurrency = String(body.priceCurrency || 'USD').toUpperCase().slice(0, 10);

        const { rows } = await db.query(
            `SELECT id, host_user_id FROM meetings WHERE meeting_provider_id = $1 LIMIT 1`,
            [params.meetCode]
        );
        if (!rows[0]) return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });
        if (Number(rows[0].host_user_id) !== Number(user.id)) {
            return NextResponse.json({ success: false, error: 'Seul l\'hôte peut modifier le tarif.' }, { status: 403 });
        }

        await ensureBillingColumns();
        await db.query(
            `UPDATE meetings SET price_amount = $1, price_currency = $2 WHERE id = $3`,
            [priceAmount, priceCurrency, rows[0].id]
        );

        return NextResponse.json({ success: true, priceAmount, priceCurrency });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
