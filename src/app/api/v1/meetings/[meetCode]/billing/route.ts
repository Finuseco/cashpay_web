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
import { quoteMeetingAccess, meetingPrice, MeetingAccessError } from '@/lib/meeting-access';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

export async function GET(
    _request: NextRequest,
    { params }: { params: { meetCode: string } }
) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });

        const { meeting, quote } = await quoteMeetingAccess(params.meetCode, user, _request.nextUrl.searchParams.get('currency') || undefined);
        return NextResponse.json({ success: true, meetCode: params.meetCode, topic: meeting.topic, type: meeting.type, status: meeting.status,
            billing: { ...quote, isPaid: quote.priceAmount > 0, hostUserId: meeting.host_user_id }, quote });
    } catch (error: any) {
        if (error instanceof MeetingAccessError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
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
        const price = meetingPrice(body.priceAmount, body.priceCurrency);
        const priceAmount = price.amount;
        const priceCurrency = price.currency;

        const { rows } = await db.query(
            `SELECT id, host_user_id FROM meetings WHERE meeting_provider_id = $1 LIMIT 1`,
            [params.meetCode]
        );
        if (!rows[0]) return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });
        if (Number(rows[0].host_user_id) !== Number(user.id)) {
            return NextResponse.json({ success: false, error: 'Seul l\'hôte peut modifier le tarif.' }, { status: 403 });
        }

        await db.query(
            `UPDATE meetings SET price_amount = $1, price_currency = $2 WHERE id = $3`,
            [priceAmount, priceCurrency, rows[0].id]
        );

        return NextResponse.json({ success: true, priceAmount, priceCurrency });
    } catch (error: any) {
        if (error instanceof MeetingAccessError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status });
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
