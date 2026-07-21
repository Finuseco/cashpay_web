
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

export async function createChessGame(user: User, betAmount: number, currency: string): Promise<{ success: boolean; gameId?: number; gameCode?: string, playerColor?: PlayerColor, error?: string }> {
    const gameCode = `CH${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const playerColor = Math.random() < 0.5 ? 'white' : 'black';
    const initialFen = new ChessLogic().getFen();

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Débiter le créateur immédiatement (Mise en jeu)
        const debit = await createTransaction({
            user,
            typeCode: 'BT', // Bet
            amount: betAmount,
            currency,
            description: `Mise en jeu échecs (Lobby #${gameCode})`,
            metadata: { gameCode, role: 'creator' },
            connection
        });

        if (!debit.success) throw new Error(debit.error || "Solde insuffisant pour la mise.");

        const { rows } = await connection.query(
            'INSERT INTO chess_games (game_code, player1_id, player1_color, bet_amount, currency, status, fen) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', 
            [gameCode, user.id, playerColor, betAmount, currency, 'waiting', initialFen]
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
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: games } = await connection.query('SELECT * FROM chess_games WHERE game_code = $1 AND status = $2 FOR UPDATE', [gameCode, 'waiting']);
        if (games.length === 0) throw new Error('Partie non trouvée ou déjà complète.');
        
        const game = games[0];
        if (game.player1_id === user.id) throw new Error('Vous ne pouvez pas rejoindre votre propre partie.');

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
        const { rows } = await db.query(`
            SELECT g.*, u1.full_name as p1_name, u2.full_name as p2_name 
            FROM chess_games g 
            LEFT JOIN users u1 ON g.player1_id = u1.id 
            LEFT JOIN users u2 ON g.player2_id = u2.id 
            WHERE g.id = $1
        `, [gameId]);
        
        if (rows.length === 0) return null;
        const game = rows[0];
        
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
            fullGame: game
        };
    } catch (e) { return null; }
}

/**
 * Résout la partie et procède au règlement financier souverain.
 */
export async function resolveChessGame(gameId: number, winnerId: number | null): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: games } = await connection.query('SELECT * FROM chess_games WHERE id = $1 AND status != $2 FOR UPDATE', [gameId, 'completed']);
        if (games.length === 0) {
            await connection.query('ROLLBACK');
            return { success: true };
        }
        
        const game = games[0];
        const betAmount = parseFloat(game.bet_amount);
        const currency = game.currency;
        const totalPot = betAmount * 2;

        if (winnerId) {
            const { rows: winnerRows } = await connection.query('SELECT * FROM users WHERE id = $1', [winnerId]);
            if (winnerRows.length === 0) throw new Error("Gagnant introuvable.");
            const winnerUser = formatUser(winnerRows[0]);
            
            // Crédit du gagnant avec le pot total (Type WG: Win Gaming)
            const credit = await createTransaction({
                user: winnerUser,
                typeCode: 'WG', 
                amount: totalPot,
                currency,
                description: `Gain Duel Échecs #${game.game_code} (Pot Total)`,
                metadata: { gameId, result: 'win', pot: totalPot, gameCode: game.game_code },
                status: 'Completed',
                connection
            });

            if (!credit.success) throw new Error("Échec du crédit souverain du gagnant.");
            
            await connection.query('UPDATE chess_games SET status = $1, winner_id = $2, updated_at = NOW() WHERE id = $3', ['completed', winnerId, gameId]);
        } else {
            // Match nul : Remboursement des deux mises (Type RW: Refund Wallet)
            const refundIds = [game.player1_id, game.player2_id];
            for (const uid of refundIds) {
                if (!uid) continue;
                const { rows: uRows } = await connection.query('SELECT * FROM users WHERE id = $1', [uid]);
                await createTransaction({
                    user: formatUser(uRows[0]),
                    typeCode: 'RW', 
                    amount: betAmount,
                    currency,
                    description: `Remboursement Match Nul Échecs #${game.game_code}`,
                    metadata: { gameId, result: 'stalemate', gameCode: game.game_code },
                    connection
                });
            }
            await connection.query("UPDATE chess_games SET status = 'completed', winner_id = NULL, updated_at = NOW() WHERE id = $1", [gameId]);
        }

        await connection.query('COMMIT');
        return { success: true };
    } catch (e: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: e.message };
    } finally {
        connection.release();
    }
}

export async function makeMove(gameId: number, move: { from: Position; to: Position }, newFen: string, promotion?: PieceType) {
    try {
        await db.query('UPDATE chess_games SET fen = $1, updated_at = NOW() WHERE id = $2', [newFen, gameId]);
        return { success: true };
    } catch (e) { return { success: false }; }
}

export async function forfeitGame(gameId: number, loserId: number | null) {
    if (!loserId) return { success: false };
    const { rows } = await db.query('SELECT player1_id, player2_id FROM chess_games WHERE id = $1', [gameId]);
    if (rows.length === 0) return { success: false };
    
    const winnerId = rows[0].player1_id === loserId ? rows[0].player2_id : rows[0].player1_id;
    return await resolveChessGame(gameId, winnerId);
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
        const { rows } = await db.query('SELECT status, draw_proposed_by FROM chess_games WHERE id = $1', [gameId]);
        if (rows.length === 0) return { success: false, error: "Partie introuvable." };
        if (rows[0].status !== 'active') return { success: false, error: "La partie n'est plus active." };
        if (rows[0].draw_proposed_by) return { success: false, error: "Une proposition est déjà en cours." };

        await db.query('UPDATE chess_games SET draw_proposed_by = $1 WHERE id = $2', [userId, gameId]);
        return { success: true };
    } catch (e) { return { success: false, error: "Erreur lors de la proposition." }; }
}

export async function respondToDraw(gameId: number, accept: boolean): Promise<{ success: boolean; error?: string }> {
    if (accept) {
        return await resolveChessGame(gameId, null);
    } else {
        try {
            await db.query('UPDATE chess_games SET draw_proposed_by = NULL WHERE id = $1', [gameId]);
            return { success: true };
        } catch (e) { return { success: false, error: "Erreur." }; }
    }
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
