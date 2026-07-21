
'use server';

import { db } from '../db';
import { handleDbError } from './helpers';
import { encryptSecret, decryptSecret } from '../encryption';
import type { User } from '../types';
import { generateReferenceCode, formatUser } from '../utils';
import { createTransaction } from './transaction.actions';

/**
 * @fileoverview Actions serveurs pour le pilotage de Starlink Enterprise.
 * Ce module sert de pont de données (Bridge) entre l'app mobile et la DB.
 */

/**
 * Enregistre ou met à jour la configuration d'un revendeur (Le Pont).
 * Le secret API est chiffré avant le stockage.
 * @param merchantWalletId - L'ID de portefeuille CashPay renseigné par l'entreprise pour ses encaissements.
 */
export async function saveResellerConfig(args: {
    userId: number;
    companyName: string;
    merchantWalletId: string;
    starlinkClientId: string;
    starlinkClientSecret: string;
}) {
    const encryptedSecret = encryptSecret(args.starlinkClientSecret);
    
    try {
        await db.query(`
            INSERT INTO starlink_resellers (user_id, company_name, starlink_account_id, api_key, api_secret, status)
            VALUES ($1, $2, $3, $4, $5, 'active')
            ON CONFLICT (user_id) DO UPDATE SET
                company_name = EXCLUDED.company_name,
                starlink_account_id = EXCLUDED.starlink_account_id,
                api_key = EXCLUDED.api_key,
                api_secret = EXCLUDED.api_secret,
                updated_at = NOW()
        `, [args.userId, args.companyName, args.merchantWalletId, args.starlinkClientId, encryptedSecret]);

        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'storing reseller bridge data');
        return { success: false, error: dbError.error };
    }
}

/**
 * Récupère les données de configuration pour l'application mobile (Login/Auth).
 * Permet à l'application mobile Kotlin/C++ de récupérer son environnement.
 */
export async function getResellerConfigForApp(userId: number) {
    try {
        const { rows } = await db.query(`
            SELECT company_name, starlink_account_id, api_key, api_secret 
            FROM starlink_resellers 
            WHERE user_id = $1
        `, [userId]);

        if (rows.length === 0) return null;
        
        const config = rows[0];
        return {
            companyName: config.company_name,
            merchantWalletId: config.starlink_account_id,
            starlinkClientId: config.api_key,
            starlinkClientSecret: decryptSecret(config.api_secret) // Déchiffré uniquement pour l'envoi sécurisé vers l'app
        };
    } catch (e) {
        return null;
    }
}

/**
 * Actions internes pour les Terminaux et Décaissements (Gérés par le Proxy Serveur)
 */
export async function registerTerminal(args: {
    resellerId: number;
    userTerminalId: string;
    nickname: string;
    ownerWalletId: string;
    serialNumber: string;
}) {
    try {
        const { rows } = await db.query(`
            INSERT INTO starlink_terminals (reseller_id, user_terminal_id, nickname, owner_wallet_id, dish_serial_number)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [args.resellerId, args.user_terminal_id, args.nickname, args.owner_wallet_id, args.serial_number]);
        return { success: true, id: rows[0].id };
    } catch (error) {
        const dbError = await handleDbError(error, 'registering terminal');
        return { success: false, error: dbError.error };
    }
}

/**
 * Traite un paiement souverain pour un abonnement Starlink initié depuis le mobile.
 */
export async function processStarlinkSubscription(args: { 
    userId: number, 
    terminalId: string, 
    amount: number,
    currency: string,
    pin: string 
}) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        
        // Trouver le revendeur associé au terminal
        const { rows: termRows } = await connection.query('SELECT reseller_id FROM starlink_terminals WHERE user_terminal_id = $1', [args.terminalId]);
        if (termRows.length === 0) throw new Error("Ce terminal n'est pas enregistré dans notre base de données.");
        const resellerId = termRows[0].reseller_id;

        // Récupérer le portefeuille de l'entreprise
        const { rows: resellerRows } = await connection.query('SELECT user_id FROM starlink_resellers WHERE id = $1', [resellerId]);
        if (resellerRows.length === 0) throw new Error("Compte revendeur introuvable.");
        const merchantId = resellerRows[0].user_id;

        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [args.userId]);
        if (userRows.length === 0) throw new Error("Utilisateur introuvable.");

        // Transaction interne de transfert
        const txResult = await createTransaction({
            user: formatUser(userRows[0]),
            typeCode: 'ABONNEMENT',
            amount: args.amount,
            currency: args.currency,
            description: `Réabonnement Starlink (Terminal: ${args.terminalId})`,
            receiver_id: merchantId,
            metadata: { starlink_billing: true, terminalId: args.terminalId },
            connection
        });

        if (!txResult.success) throw new Error(txResult.error);
        
        await connection.query('COMMIT');
        return { success: true, reference: txResult.reference };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}
