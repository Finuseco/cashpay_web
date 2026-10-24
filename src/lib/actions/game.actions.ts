
'use server';

import type { User, CasinoTransaction, PlayerColor, PieceType } from '../types';
import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { createTransaction } from './transaction.actions';
import { format } from 'date-fns';
import { ChessLogic } from '../chess-logic';
import type { Position } from '../types';
import { getAuthenticatedUser } from './user.actions';
import { formatUser } from '../utils';

/**
 * @fileoverview Logique métier pour les échecs monétisés v2.2.
 * Gère les parties, les invitations, le lobby public et le règlement financier.
 */

const MOVE_SECONDS = 60;          // durée d'un coup
const PAUSE_SECONDS = 60;         // pause unique par joueur
const TIMEOUT_GRACE_SECONDS = 3;  // tolérance réseau avant de déclarer un dépassement de temps

/** L'utilisateur est toujours celui de la session : un identifiant venu du navigateur n'est jamais cru. */
async function sessionUser(): Promise<User | null> {
    try {
        return await getAuthenticatedUser();
    } catch {
        return null;
    }
}

function colorOf(game: any, userId: number): PlayerColor | null {
    if (Number(game.player1_id) === Number(userId)) return game.player1_color;
    if (game.player2_id && Number(game.player2_id) === Number(userId)) return game.player1_color === 'white' ? 'black' : 'white';
    return null;
}

function money(n: number): number {
    return Math.round(n * 100) / 100;
}

const pauseUsed = new Set<string>(); // `${gameId}:${userId}` — une pause par joueur et par partie

export async function createChessGame(user: User, betAmount: number, currency: string): Promise<{ success: boolean; gameId?: number; gameCode?: string, playerColor?: PlayerColor, error?: string }> {
    const me = await sessionUser();
    if (!me) return { success: false, error: 'Session expirée. Veuillez vous reconnecter.' };
    user = me;

    const bet = money(Number(betAmount));
    if (!Number.isFinite(bet) || bet <= 0) return { success: false, error: 'Mise invalide.' };
    if (typeof currency !== 'string' || !/^[A-Z]{3,10}$/.test(currency)) return { success: false, error: 'Devise invalide.' };

    const gameCode = `CH${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const playerColor: PlayerColor = Math.random() < 0.5 ? 'white' : 'black';
    const initialFen = new ChessLogic().getFen();

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Débiter le créateur immédiatement (Mise en jeu)
        const debit = await createTransaction({
            user,
            typeCode: 'BT', // Bet
            amount: bet,
            currency,
            description: `Mise en jeu échecs (Lobby #${gameCode})`,
            metadata: { gameCode, role: 'creator' },
            connection
        });

        if (!debit.success) throw new Error(debit.error || "Solde insuffisant pour la mise.");

        const { rows } = await connection.query(
            'INSERT INTO chess_games (game_code, player1_id, player1_color, bet_amount, currency, status, fen) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', 
            [gameCode, user.id, playerColor, bet, currency, 'waiting', initialFen]
        );

        await connection.query('COMMIT');
        return { success: true, gameId: rows[0].id, gameCode, playerColor };
    } catch(error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function joinChessGame(user: User, gameCode: string): Promise<{ success: boolean; error?: string; opponent?: User; gameId?: number; betAmount?: number, currency?: string, playerColor?: PlayerColor }> {
    const me = await sessionUser();
    if (!me) return { success: false, error: 'Session expirée. Veuillez vous reconnecter.' };
    user = me;
    const code = String(gameCode || '').trim().toUpperCase();
    if (!code) return { success: false, error: 'Code requis.' };

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: games } = await connection.query('SELECT * FROM chess_games WHERE game_code = $1 AND status = $2 FOR UPDATE', [code, 'waiting']);
        if (games.length === 0) throw new Error('Partie non trouvée ou déjà complète.');
        
        const game = games[0];
        if (Number(game.player1_id) === Number(user.id)) throw new Error('Vous ne pouvez pas rejoindre votre propre partie.');

        // 2. Débiter le second joueur immédiatement (Mise en jeu)
        const debit = await createTransaction({
            user,
            typeCode: 'BT',
            amount: parseFloat(game.bet_amount),
            currency: game.currency,
            description: `Mise en jeu échecs vs #${game.game_code}`,
            metadata: { gameCode: game.game_code, role: 'joiner' },
            connection
        });

        if (!debit.success) throw new Error(debit.error || "Solde insuffisant pour rejoindre.");

        const player2Color = game.player1_color === 'white' ? 'black' : 'white';
        await connection.query('UPDATE chess_games SET player2_id = $1, status = $2, updated_at = NOW() WHERE id = $3', [user.id, 'active', game.id]);
        
        const { rows: opponentRows } = await connection.query('SELECT * FROM users WHERE id = $1', [game.player1_id]);
        const opponent = formatUser(opponentRows[0]);

        await connection.query('COMMIT');
        return { success: true, opponent, gameId: game.id, betAmount: parseFloat(game.bet_amount), currency: game.currency, playerColor: player2Color };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}

export async function getGameState(gameId: number) {
    try {
        const me = await sessionUser();
        if (!me) return null;

        const { rows } = await db.query(`
            SELECT g.*, u1.full_name as p1_name, u2.full_name as p2_name,
                   GREATEST(0, EXTRACT(EPOCH FROM (NOW() - g.updated_at)))::float AS idle_seconds
            FROM chess_games g 
            LEFT JOIN users u1 ON g.player1_id = u1.id 
            LEFT JOIN users u2 ON g.player2_id = u2.id 
            WHERE g.id = $1
        `, [gameId]);
        
        if (rows.length === 0) return null;
        const game = rows[0];
        if (colorOf(game, me.id) === null) return null; // réservé aux deux joueurs
        
        return {
            gameId: game.id,
            fen: game.fen,
            status: game.status,
            turn: game.fen.split(' ')[1] === 'w' ? 'white' : 'black',
            betAmount: parseFloat(game.bet_amount),
            currency: game.currency,
            winnerId: game.winner_id,
            p1_name: game.p1_name,
            p2_name: game.p2_name,
            drawProposedBy: game.draw_proposed_by,
            idleSeconds: Number(game.idle_seconds),
            fullGame: JSON.parse(JSON.stringify(game))
        };
    } catch (e) { return null; }
}

/**
 * Règlement financier (interne, jamais exposé au navigateur).
 *  - winnerId : le gagnant reçoit le POT TOTAL = mise × 2 (sa mise + celle de l'adversaire), une seule fois ;
 *  - winnerId = null : nul, chaque joueur est remboursé de SA mise ;
 *  - partie encore « waiting » (personne n'a rejoint) : seul le créateur est remboursé.
 * Idempotent : le verrou FOR UPDATE + le statut « completed » empêchent tout double paiement.
 */
async function settleChessGame(gameId: number, winnerId: number | null): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: games } = await connection.query("SELECT * FROM chess_games WHERE id = $1 AND status IN ('waiting','active') FOR UPDATE", [gameId]);
        if (games.length === 0) {
            await connection.query('ROLLBACK');
            return { success: true }; // déjà réglée
        }
        
        const game = games[0];
        const betAmount = money(parseFloat(game.bet_amount));
        const currency = game.currency;
        const hasOpponent = !!game.player2_id;

        const refund = async (uid: number, why: string) => {
            const { rows: uRows } = await connection.query('SELECT * FROM users WHERE id = $1', [uid]);
            if (uRows.length === 0) throw new Error('Joueur introuvable pour le remboursement.');
            const r = await createTransaction({
                user: formatUser(uRows[0]),
                typeCode: 'RW',
                amount: betAmount,
                currency,
                description: `${why} Échecs #${game.game_code}`,
                metadata: { gameId, result: 'refund', gameCode: game.game_code },
                connection
            });
            if (!r.success) throw new Error(r.error || 'Remboursement échoué.');
        };

        if (!hasOpponent) {
            // Invitation annulée : on rend sa mise au créateur.
            await refund(game.player1_id, 'Annulation invitation');
            await connection.query("UPDATE chess_games SET status = 'cancelled', winner_id = NULL, updated_at = NOW() WHERE id = $1", [gameId]);
        } else if (winnerId) {
            if (![Number(game.player1_id), Number(game.player2_id)].includes(Number(winnerId))) throw new Error('Gagnant invalide.');
            const totalPot = money(betAmount * 2);

            const { rows: winnerRows } = await connection.query('SELECT * FROM users WHERE id = $1', [winnerId]);
            if (winnerRows.length === 0) throw new Error("Gagnant introuvable.");

            // Type WG (Win Gaming) : crédit unique du pot (mise × 2).
            const credit = await createTransaction({
                user: formatUser(winnerRows[0]),
                typeCode: 'WG', 
                amount: totalPot,
                currency,
                description: `Gain Duel Échecs #${game.game_code} (Pot Total)`,
                metadata: { gameId, result: 'win', pot: totalPot, bet: betAmount, gameCode: game.game_code },
                status: 'Completed',
                connection
            });

            if (!credit.success) throw new Error("Échec du crédit souverain du gagnant.");
            
            await connection.query('UPDATE chess_games SET status = $1, winner_id = $2, updated_at = NOW() WHERE id = $3', ['completed', winnerId, gameId]);
        } else {
            // Match nul : remboursement de la mise de chacun
            await refund(game.player1_id, 'Remboursement Match Nul');
            await refund(game.player2_id, 'Remboursement Match Nul');
            await connection.query("UPDATE chess_games SET status = 'completed', winner_id = NULL, updated_at = NOW() WHERE id = $1", [gameId]);
        }

        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        console.error('[settleChessGame]', e);
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}

async function loadGameFor(gameId: number, userId: number) {
    const { rows } = await db.query(
        `SELECT g.*, GREATEST(0, EXTRACT(EPOCH FROM (NOW() - g.updated_at)))::float AS idle_seconds FROM chess_games g WHERE g.id = $1`,
        [gameId]
    );
    if (rows.length === 0) return { error: 'Partie introuvable.' as const };
    const game = rows[0];
    const myColor = colorOf(game, userId);
    if (!myColor) return { error: "Vous ne participez pas à cette partie." as const };
    return { game, myColor };
}

/**
 * Résolution demandée par un client (web ou mobile). Le serveur ne croit pas le client :
 *  - victoire de l'appelant : seulement si la position enregistrée est un échec et mat, ou si l'adversaire a dépassé son temps ;
 *  - l'appelant déclare l'adversaire vainqueur : abandon, toujours accepté ;
 *  - nul : seulement après une proposition de l'adversaire, ou si la position est un pat.
 */
export async function resolveChessGame(gameId: number, winnerId: number | null): Promise<{ success: boolean; error?: string }> {
    const me = await sessionUser();
    if (!me) return { success: false, error: 'Session expirée.' };
    const loaded = await loadGameFor(gameId, me.id);
    if ('error' in loaded) return { success: false, error: loaded.error };
    const { game, myColor } = loaded;

    if (game.status === 'completed' || game.status === 'cancelled') return { success: true };
    if (game.status === 'waiting') return { success: false, error: "Utilisez l'annulation de l'invitation." };

    const logic = new ChessLogic(undefined, game.fen);
    const oppId = Number(game.player1_id) === Number(me.id) ? Number(game.player2_id) : Number(game.player1_id);
    const oppColor: PlayerColor = myColor === 'white' ? 'black' : 'white';

    if (winnerId === null || winnerId === undefined) {
        const proposedByOpponent = game.draw_proposed_by && Number(game.draw_proposed_by) === oppId;
        const stalemate = logic.isStalemate(logic.turn);
        if (!proposedByOpponent && !stalemate) return { success: false, error: "Nul non accepté par l'adversaire." };
        return settleChessGame(gameId, null);
    }

    if (Number(winnerId) === oppId) {
        return settleChessGame(gameId, oppId); // abandon / défaite reconnue
    }
    if (Number(winnerId) !== Number(me.id)) return { success: false, error: 'Gagnant invalide.' };

    const mated = logic.isCheckmate(oppColor) && logic.turn === oppColor;
    const timedOut = logic.turn === oppColor && Number(game.idle_seconds) > MOVE_SECONDS + TIMEOUT_GRACE_SECONDS;
    if (!mated && !timedOut) return { success: false, error: "Victoire non confirmée par la position." };
    return settleChessGame(gameId, Number(me.id));
}

/**
 * Enregistre un coup. Le serveur rejoue le coup depuis la position enregistrée, vérifie que c'est bien le tour
 * du joueur et que le coup est légal, puis calcule lui-même la nouvelle position (le FEN envoyé par le client est
 * ignoré). Si le coup donne mat ou pat, la partie est réglée immédiatement par le serveur.
 */
export async function makeMove(gameId: number, move: { from: Position; to: Position }, newFen?: string, promotion?: PieceType): Promise<{ success: boolean; error?: string; fen?: string; ended?: 'checkmate' | 'stalemate' }> {
    try {
        const me = await sessionUser();
        if (!me) return { success: false, error: 'Session expirée.' };

        const connection = await db.getConnection();
        try {
            await connection.query('BEGIN');
            const { rows } = await connection.query('SELECT * FROM chess_games WHERE id = $1 FOR UPDATE', [gameId]);
            if (rows.length === 0) throw new Error('Partie introuvable.');
            const game = rows[0];
            const myColor = colorOf(game, me.id);
            if (!myColor) throw new Error("Vous ne participez pas à cette partie.");
            if (game.status !== 'active') throw new Error("La partie n'est pas active.");

            const logic = new ChessLogic(undefined, game.fen);
            if (logic.turn !== myColor) throw new Error("Ce n'est pas votre tour.");

            const f = move?.from, t = move?.to;
            const ok = (p: any) => p && Number.isInteger(p.row) && Number.isInteger(p.col) && p.row >= 0 && p.row < 8 && p.col >= 0 && p.col < 8;
            if (!ok(f) || !ok(t)) throw new Error('Coup invalide.');
            const piece = logic.board[f.row][f.col];
            if (!piece || piece.color !== myColor) throw new Error('Pièce invalide.');
            if (!logic.getValidMovesForPiece(f).some(m => m.row === t.row && m.col === t.col)) throw new Error('Coup illégal.');

            const promoting = piece.type === 'pawn' && (t.row === 0 || t.row === 7);
            const promo: PieceType | undefined = promoting
                ? (['queen', 'rook', 'bishop', 'knight'].includes(String(promotion)) ? promotion : 'queen')
                : undefined;
            logic.movePiece(f, t, promo);

            const fen = logic.getFen();
            await connection.query('UPDATE chess_games SET fen = $1, updated_at = NOW(), draw_proposed_by = NULL WHERE id = $2', [fen, gameId]);
            await connection.query('COMMIT');

            // Fin de partie décidée par le serveur.
            let ended: 'checkmate' | 'stalemate' | undefined;
            if (logic.isCheckmate(logic.turn)) {
                ended = 'checkmate';
                await settleChessGame(gameId, Number(me.id));
            } else if (logic.isStalemate(logic.turn)) {
                ended = 'stalemate';
                await settleChessGame(gameId, null);
            }
            return { success: true, fen, ended };
        } catch (e: any) {
            await connection.query('ROLLBACK');
            return { success: false, error: e.message };
        } finally {
            connection.release();
        }
    } catch (e) { return { success: false, error: 'Erreur serveur.' }; }
}

/**
 * Abandon ou dépassement de temps.
 *  - loserId = l'appelant : abandon ;
 *  - loserId = l'adversaire : accepté uniquement si c'est à lui de jouer et que son temps est écoulé (horloge serveur).
 */
export async function forfeitGame(gameId: number, loserId: number | null) {
    if (!loserId) return { success: false };
    const me = await sessionUser();
    if (!me) return { success: false, error: 'Session expirée.' };
    const loaded = await loadGameFor(gameId, me.id);
    if ('error' in loaded) return { success: false, error: loaded.error };
    const { game, myColor } = loaded;

    if (game.status === 'completed' || game.status === 'cancelled') return { success: true };
    if (game.status === 'waiting') return cancelChessInvite(gameId);

    const oppId = Number(game.player1_id) === Number(me.id) ? Number(game.player2_id) : Number(game.player1_id);
    if (Number(loserId) === Number(me.id)) return settleChessGame(gameId, oppId);

    if (Number(loserId) !== oppId) return { success: false, error: 'Joueur invalide.' };
    const oppColor: PlayerColor = myColor === 'white' ? 'black' : 'white';
    const turn = new ChessLogic(undefined, game.fen).turn;
    if (turn !== oppColor || Number(game.idle_seconds) <= MOVE_SECONDS + TIMEOUT_GRACE_SECONDS) {
        return { success: false, error: "Le temps de l'adversaire n'est pas écoulé." };
    }
    return settleChessGame(gameId, Number(me.id));
}

/** Le créateur annule son invitation : sa mise lui est rendue. */
export async function cancelChessInvite(gameId: number): Promise<{ success: boolean; error?: string }> {
    const me = await sessionUser();
    if (!me) return { success: false, error: 'Session expirée.' };
    const { rows } = await db.query('SELECT player1_id, status FROM chess_games WHERE id = $1', [gameId]);
    if (rows.length === 0) return { success: false, error: 'Partie introuvable.' };
    if (Number(rows[0].player1_id) !== Number(me.id)) return { success: false, error: 'Réservé au créateur.' };
    if (rows[0].status !== 'waiting') return { success: true };
    return settleChessGame(gameId, null);
}

/** Pause unique de 60 s pour le joueur dont c'est le tour : l'horloge serveur est décalée d'autant. */
export async function pauseChessGame(gameId: number): Promise<{ success: boolean; error?: string }> {
    const me = await sessionUser();
    if (!me) return { success: false, error: 'Session expirée.' };
    const loaded = await loadGameFor(gameId, me.id);
    if ('error' in loaded) return { success: false, error: loaded.error };
    const { game, myColor } = loaded;
    if (game.status !== 'active') return { success: false, error: "La partie n'est pas active." };
    if (new ChessLogic(undefined, game.fen).turn !== myColor) return { success: false, error: "La pause n'est possible que pendant votre tour." };
    const key = `${gameId}:${me.id}`;
    if (pauseUsed.has(key)) return { success: false, error: 'Pause déjà utilisée.' };
    pauseUsed.add(key);
    await db.query(`UPDATE chess_games SET updated_at = NOW() + ($1 || ' seconds')::interval WHERE id = $2`, [String(PAUSE_SECONDS), gameId]);
    return { success: true };
}

/**
 * Récupère les invitations en attente pour le Lobby.
 */
export async function getOpenInvitations(): Promise<any[]> {
    try {
        const { rows } = await db.query(`
            SELECT g.*, u.full_name as creator_name, u.profile_photo as creator_photo
            FROM chess_games g
            JOIN users u ON g.player1_id = u.id
            WHERE g.status = 'waiting'
            ORDER BY g.created_at DESC
        `);
        return rows;
    } catch (e) { return []; }
}

/**
 * Historique complet des matchs joués par un utilisateur.
 */
export async function getPlayerMatchHistory(userId: number): Promise<any[]> {
    try {
        const { rows } = await db.query(`
            SELECT g.*, 
                u1.full_name as p1_name, u2.full_name as p2_name,
                w.full_name as winner_name
            FROM chess_games g
            JOIN users u1 ON g.player1_id = u1.id
            LEFT JOIN users u2 ON g.player2_id = u2.id
            LEFT JOIN users w ON g.winner_id = w.id
            WHERE g.player1_id = $1 OR g.player2_id = $1
            ORDER BY g.created_at DESC
        `, [userId]);
        return rows;
    } catch (e) { return []; }
}

export async function proposeDraw(gameId: number, userId: number): Promise<{ success: boolean; error?: string }> {
    try {
        const me = await sessionUser();
        if (!me) return { success: false, error: 'Session expirée.' };
        const { rows } = await db.query('SELECT status, draw_proposed_by, player1_id, player2_id FROM chess_games WHERE id = $1', [gameId]);
        if (rows.length === 0) return { success: false, error: "Partie introuvable." };
        if (![Number(rows[0].player1_id), Number(rows[0].player2_id)].includes(Number(me.id))) return { success: false, error: "Vous ne participez pas à cette partie." };
        if (rows[0].status !== 'active') return { success: false, error: "La partie n'est plus active." };
        if (rows[0].draw_proposed_by) return { success: false, error: "Une proposition est déjà en cours." };

        await db.query('UPDATE chess_games SET draw_proposed_by = $1 WHERE id = $2', [me.id, gameId]);
        return { success: true };
    } catch (e) { return { success: false, error: "Erreur lors de la proposition." }; }
}

export async function respondToDraw(gameId: number, accept: boolean): Promise<{ success: boolean; error?: string }> {
    const me = await sessionUser();
    if (!me) return { success: false, error: 'Session expirée.' };
    const loaded = await loadGameFor(gameId, me.id);
    if ('error' in loaded) return { success: false, error: loaded.error };
    if (!loaded.game.draw_proposed_by || Number(loaded.game.draw_proposed_by) === Number(me.id)) {
        return { success: false, error: "Aucune proposition à laquelle répondre." };
    }
    if (accept) {
        return await settleChessGame(gameId, null);
    }
    try {
        await db.query('UPDATE chess_games SET draw_proposed_by = NULL WHERE id = $1', [gameId]);
        return { success: true };
    } catch (e) { return { success: false, error: "Erreur." }; }
}

export async function getCasinoTransactions(userId: number): Promise<CasinoTransaction[]> {
    try {
        const { rows } = await db.query(
            `SELECT t.*, t.reference_code as "referenceCode"
            FROM transactions t 
            WHERE (t.sender_id = $1 OR t.receiver_id = $1) AND t.type_code IN ('BT', 'WG', 'LS', 'RW')
            ORDER BY t.created_at DESC LIMIT 50`, [userId]
        );

        return rows.map(row => ({
            id: row.id.toString(),
            user_wallet_id: row.sender_wallet_id,
            platform_id: 'chess',
            game_id: 'chess',
            tx_type: row.type_code === 'WG' ? 'win' : (row.type_code === 'RW' ? 'deposit' : 'loss'),
            amount: parseFloat(row.amount),
            currency: row.currency,
            description: row.description,
            reference_code: row.referenceCode,
            timestamp: new Date(row.created_at).toISOString()
        })) as CasinoTransaction[];
    } catch(error) {
        return [];
    }
}
