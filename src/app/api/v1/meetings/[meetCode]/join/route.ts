/**
 * POST /api/v1/meetings/:meetCode/join
 * Enregistre la présence d'un participant à une réunion.
 * Si la réunion est payante, débite le participant et crédite l'organisateur.
 *
 * Body (optionnel) :
 *   { pin?: string, currency?: string }
 *   - pin      : code PIN de l'utilisateur (requis si meeting payant)
 *   - currency : devise préférée pour le paiement (optionnel, auto-détecté sinon)
 *
 * Réponse :
 *   { success, meetCode, joinUrl, topic, type, participants, charged?, amount?, currency? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

async function ensureParticipantsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS meeting_participants (
            id         SERIAL PRIMARY KEY,
            meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            joined_at  TIMESTAMPTZ DEFAULT NOW(),
            left_at    TIMESTAMPTZ,
            is_host    BOOLEAN DEFAULT FALSE,
            fee_paid   NUMERIC(18,8) DEFAULT 0,
            fee_currency VARCHAR(10),
            UNIQUE(meeting_id, user_id)
        );
    `).catch(() => {});
    // Ajouter les colonnes si elles n'existent pas (migration douce)
    await db.query(`
        ALTER TABLE meeting_participants
            ADD COLUMN IF NOT EXISTS fee_paid     NUMERIC(18,8) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS fee_currency VARCHAR(10)
    `).catch(() => {});
}

export async function POST(
    request: NextRequest,
    { params }: { params: { meetCode: string } }
) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        }

        const meetCode = String(params.meetCode || '').trim();
        if (!meetCode) {
            return NextResponse.json({ success: false, error: 'Code de réunion manquant.' }, { status: 400 });
        }

        let body: any = {};
        try { body = await request.json(); } catch { /* body vide */ }

        // --- Récupérer le meeting ---
        const { rows } = await db.query(
            `SELECT id, status, topic, type, join_url, host_user_id,
                    COALESCE(price_amount, 0)   AS price_amount,
                    COALESCE(price_currency, 'USD') AS price_currency
             FROM meetings WHERE meeting_provider_id = $1 LIMIT 1`,
            [meetCode]
        );

        if (!rows[0]) {
            return NextResponse.json({ success: false, error: 'Réunion introuvable.' }, { status: 404 });
        }

        const meeting = rows[0];
        if (meeting.status === 'ended') {
            return NextResponse.json({ success: false, error: 'Cette réunion est terminée.' }, { status: 410 });
        }

        const isHost = Number(meeting.host_user_id) === Number(user.id);
        const priceAmount = Number(meeting.price_amount);
        const priceCurrency = String(meeting.price_currency || 'USD').toUpperCase();

        // --- Vérifier si déjà participant (a déjà payé) ---
        await ensureParticipantsTable();
        const { rows: existingRows } = await db.query(
            `SELECT id, fee_paid FROM meeting_participants
             WHERE meeting_id = $1 AND user_id = $2 LIMIT 1`,
            [meeting.id, user.id]
        );
        const alreadyJoined = existingRows.length > 0 && Number(existingRows[0].fee_paid) > 0;

        // --- Meeting payant : débiter le participant ---
        if (priceAmount > 0 && !isHost && !alreadyJoined) {
            const pin = String(body.pin || '').trim();
            if (!pin) {
                return NextResponse.json({
                    success: false,
                    error: 'PIN requis pour rejoindre cette réunion payante.',
                    requiresPin: true,
                    priceAmount,
                    priceCurrency,
                }, { status: 402 });
            }

            // Vérifier le PIN
            const { rows: userRows } = await db.query(
                `SELECT pin_hash FROM users WHERE id = $1 LIMIT 1`,
                [user.id]
            );
            const pinHash = userRows[0]?.pin_hash;
            if (!pinHash || !(await bcrypt.compare(pin, pinHash))) {
                return NextResponse.json({ success: false, error: 'PIN incorrect.' }, { status: 403 });
            }

            // Déterminer la devise à utiliser
            const preferredCurrency = String(body.currency || priceCurrency).toUpperCase();

            // Récupérer le wallet du participant
            const { rows: walletRows } = await db.query(
                `SELECT balances FROM wallets WHERE user_id = $1 LIMIT 1`,
                [user.id]
            );
            if (!walletRows[0]) {
                return NextResponse.json({ success: false, error: 'Portefeuille introuvable.' }, { status: 404 });
            }
            const balances: Record<string, number> = walletRows[0].balances || {};

            // Chercher une devise disponible avec solde suffisant
            // Priorité : devise demandée → devise du meeting → devises du portefeuille
            const tryOrder = [preferredCurrency, priceCurrency];
            let usedCurrency: string | null = null;
            let debitAmount = priceAmount;

            for (const cur of tryOrder) {
                const bal = Number(balances[cur] || 0);
                if (cur === priceCurrency && bal >= priceAmount) {
                    usedCurrency = cur;
                    debitAmount = priceAmount;
                    break;
                } else if (cur !== priceCurrency && bal > 0) {
                    // Conversion simple via taux de change
                    const { rows: rateRows } = await db.query(
                        `SELECT rate FROM exchange_rates
                         WHERE from_currency = $1 AND to_currency = $2
                         ORDER BY created_at DESC LIMIT 1`,
                        [priceCurrency, cur]
                    ).catch(() => ({ rows: [] }));
                    if (rateRows[0]) {
                        const converted = priceAmount * Number(rateRows[0].rate);
                        if (bal >= converted) {
                            usedCurrency = cur;
                            debitAmount = converted;
                            break;
                        }
                    }
                }
            }

            if (!usedCurrency) {
                return NextResponse.json({
                    success: false,
                    error: `Solde insuffisant. Frais : ${priceAmount} ${priceCurrency}.`,
                    priceAmount,
                    priceCurrency,
                }, { status: 402 });
            }

            // Transaction : débiter participant, créditer organisateur
            const conn = await (db as any).connect();
            try {
                await conn.query('BEGIN');

                // Débiter participant
                const newParticipantBal = Number(balances[usedCurrency] || 0) - debitAmount;
                balances[usedCurrency] = newParticipantBal;
                await conn.query(
                    `UPDATE wallets SET balances = $1::jsonb WHERE user_id = $2`,
                    [JSON.stringify(balances), user.id]
                );

                // Créditer organisateur
                const { rows: hostWalletRows } = await conn.query(
                    `SELECT balances FROM wallets WHERE user_id = $1 LIMIT 1`,
                    [meeting.host_user_id]
                );
                if (hostWalletRows[0]) {
                    const hostBal: Record<string, number> = hostWalletRows[0].balances || {};
                    hostBal[usedCurrency] = Number(hostBal[usedCurrency] || 0) + debitAmount;
                    await conn.query(
                        `UPDATE wallets SET balances = $1::jsonb WHERE user_id = $2`,
                        [JSON.stringify(hostBal), meeting.host_user_id]
                    );
                }

                // Enregistrer la transaction
                await conn.query(
                    `INSERT INTO transactions (sender_id, receiver_id, amount, currency, type, description, status, created_at)
                     VALUES ($1, $2, $3, $4, 'meeting_fee', $5, 'completed', NOW())`,
                    [user.id, meeting.host_user_id, debitAmount, usedCurrency,
                     `Frais d'accès réunion ${meetCode}`]
                ).catch(() => {}); // table peut varier

                await conn.query('COMMIT');
            } catch (txErr: any) {
                await conn.query('ROLLBACK');
                conn.release();
                return NextResponse.json({ success: false, error: 'Erreur lors du paiement.' }, { status: 500 });
            }
            conn.release();

            // Enregistrer la participation avec le montant payé
            await db.query(
                `INSERT INTO meeting_participants (meeting_id, user_id, is_host, joined_at, fee_paid, fee_currency)
                 VALUES ($1, $2, FALSE, NOW(), $3, $4)
                 ON CONFLICT (meeting_id, user_id) DO UPDATE
                   SET joined_at = NOW(), left_at = NULL, fee_paid = $3, fee_currency = $4`,
                [meeting.id, user.id, debitAmount, usedCurrency]
            );

            const { rows: countRows } = await db.query(
                `SELECT COUNT(*) AS cnt FROM meeting_participants WHERE meeting_id = $1 AND left_at IS NULL`,
                [meeting.id]
            );

            return NextResponse.json({
                success: true,
                meetCode,
                joinUrl: meeting.join_url,
                topic: meeting.topic,
                type: meeting.type,
                participants: Number(countRows[0]?.cnt) || 1,
                charged: true,
                amount: debitAmount,
                currency: usedCurrency,
            });
        }

        // --- Réunion gratuite ou hôte ---
        await db.query(
            `INSERT INTO meeting_participants (meeting_id, user_id, is_host, joined_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (meeting_id, user_id) DO UPDATE SET joined_at = NOW(), left_at = NULL`,
            [meeting.id, user.id, isHost]
        );

        const { rows: countRows } = await db.query(
            `SELECT COUNT(*) AS cnt FROM meeting_participants WHERE meeting_id = $1 AND left_at IS NULL`,
            [meeting.id]
        );

        return NextResponse.json({
            success: true,
            meetCode,
            joinUrl: meeting.join_url,
            topic: meeting.topic,
            type: meeting.type,
            participants: Number(countRows[0]?.cnt) || 1,
            charged: false,
        });
    } catch (error: any) {
        console.error('[POST /api/v1/meetings/:meetCode/join]', error?.message);
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
