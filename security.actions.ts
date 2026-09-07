
'use server';

import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createTransaction, sendTransactionNotifications } from './transaction.actions';
import { getAuthenticatedUser } from './user.actions';
import { formatUser, generateReferenceCode, countryToCode } from '@/lib/utils';
import { calculateTransactionFee } from './wallet.actions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { PoolClient } from 'pg';
import { createNotification } from './notification.actions';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';

/**
 * Signe une transaction avec une clé matérielle (Instrument au porteur).
 */
export async function signTransactionWithHardwareKey(args: { 
    amount: number; 
    currency: string; 
    securityLevel: 'none' | 'pin_protected';
    keyPin?: string;
    userPin: string;
    partnerId?: number; 
    partnerFleetWalletId?: string;
}): Promise<{ success: boolean; signature: string; reference: string; encryptedPayload: string; fileContent: string; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, signature: '', reference: '', encryptedPayload: '', fileContent: '', error: 'Utilisateur non authentifié.' };

    if (!user.pin_hash || !(await bcrypt.compare(args.userPin, user.pin_hash))) {
        return { success: false, signature: '', reference: '', encryptedPayload: '', fileContent: '', error: 'Code PIN personnel incorrect.' };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const reference = generateReferenceCode('HSM');
        const countryCode = countryToCode(user.country) || 'GBL';
        
        const amountNum = Number(args.amount);
        const fee = await calculateTransactionFee(amountNum, args.currency, 'HSM_LOCK', user.country, connection);

        const txResult = await createTransaction({
            user,
            typeCode: args.partnerId ? 'B2B_HSM_ISSUE' : 'HSM_LOCK',
            amount: amountNum,
            currency: args.currency,
            description: `Mise en coffre USB - Origine: ${args.partnerId ? 'Partenaire B2B' : 'CashPay App'}`,
            metadata: { 
                security_level: args.securityLevel,
                is_hardware_key: true,
                fee_applied: fee,
                issuerName: user.full_name,
                issuerWallet: user.id_wallet
            },
            status: 'Completed',
            referenceCode: reference,
            connection
        });

        if (!txResult.success || !txResult.transactionId) {
            throw new Error(txResult.error || "Échec du prélèvement de la valeur.");
        }

        const nonce = crypto.randomBytes(16).toString('hex');
        const hsmSignature = crypto.createHmac('sha256', process.env.JWT_SECRET || 'cp_network_vault')
            .update(`${txResult.transactionId}-${nonce}-${amountNum}`)
            .digest('hex');

        const rawData = {
            ref: reference,
            amount: amountNum,
            currency: args.currency,
            iss: args.partnerId ? "B2B Partner Bank" : "CashPay Native",
            cou: countryCode,
            h: hsmSignature,
            sec: args.securityLevel,
            owner: user.full_name,
        };
        const encryptedPayload = Buffer.from(JSON.stringify(rawData)).toString('base64');

        const fileContent = `
=====================================================================
          CASHPAY SECURE HARDWARE ASSET - PREUVE DE PROPRIÉTÉ
=====================================================================

DÉTAILS DU CERTIFICAT :
---------------------------------------------------------------------
VERSION: 2.0
NIVEAU DE SÉCURITÉ: ${args.securityLevel}
CLÉ H (SIGNATURE): ${hsmSignature}
DATE D'ÉMISSION: ${format(new Date(), "dd MMMM yyyy HH:mm:ss", { locale: fr })}
TITULAIRE: ${user.full_name.toUpperCase()}
VALEUR NOMINALE: ${amountNum.toFixed(2)} ${args.currency}
ORIGINE: ${args.partnerId ? "Banque Partenaire" : "CashPay Central Network"}
---------------------------------------------------------------------

[SECURE-DATA-BLOCK]
${encryptedPayload}
[/SECURE-DATA-BLOCK]

_____________________________________________________________________
Protected by CashPay HSM Protocol. (c) ${new Date().getFullYear()} FINUSECO SARL.
`.trim();

        let hashedKeyPin = null;
        if (args.securityLevel === 'pin_protected' && args.keyPin) {
            hashedKeyPin = await bcrypt.hash(args.keyPin, 10);
        }

        await connection.query(`
            INSERT INTO hardware_keys (
                key_reference, owner_user_id, 
                issuing_bank_name, issuing_country_code,
                amount, currency, security_level, pin_hash, 
                hsm_signature, status, source_transaction_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                reference, user.id, 
                args.partnerId ? "Banque Partenaire" : "CashPay App", 
                countryCode, amountNum, args.currency, args.securityLevel, 
                hashedKeyPin, hsmSignature, 'active', txResult.transactionId
            ]
        );

        await connection.query('COMMIT');

        // Alerte à la création
        const creationMsg = `CashPay Securité: Votre certificat .cpk de ${amountNum} ${args.currency} a été généré avec succès. Réf: ${reference}.`;
        await createNotification(user.id, 'Certificat HSM émis', creationMsg, 'general');

        sendTransactionNotifications(user, {
            description: `Mise en coffre USB (${amountNum} ${args.currency})`,
            amount: amountNum,
            currency: args.currency,
            fee: txResult.fee || 0,
            reference: reference,
            newBalance: txResult.senderNewBalance!,
            typeCode: args.partnerId ? 'B2B_HSM_ISSUE' : 'HSM_LOCK'
        }).catch(console.error);

        return { success: true, signature: hsmSignature, reference, encryptedPayload, fileContent };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, signature: '', reference: '', encryptedPayload: '', fileContent: '', error: error.message };
    } finally {
        connection.release();
    }
}

/**
 * Encaisse une clé USB (Libération de la valeur du registre).
 * Vérifie si la clé est expirée ou vide.
 */
export async function recoverSignedBalance(args: { 
    signature: string; 
    keyPin?: string;
    partialAmount?: number;
}): Promise<{ success: boolean; amount?: number; currency?: string; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Identification requise." };

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows } = await connection.query(
            `SELECT hk.*, u.full_name as issuer_name, u.id_wallet as issuer_wallet
             FROM hardware_keys hk
             JOIN users u ON hk.owner_user_id = u.id
             WHERE hk.hsm_signature = $1 AND hk.status NOT IN ('claimed', 'cancelled', 'expired') FOR UPDATE`,
            [args.signature]
        );

        if (rows.length === 0) throw new Error("Certificat invalide, déjà encaissé, expiré ou révoqué. Veuillez utiliser une autre clé.");
        const key = rows[0];

        if (key.security_level === 'pin_protected') {
            if (!args.keyPin) throw new Error("Ce certificat est protégé par un code PIN de sécurité.");
            const isPinValid = await bcrypt.compare(args.keyPin, key.pin_hash);
            if (!isPinValid) throw new Error("Code PIN du certificat incorrect.");
        }

        const currentAmount = parseFloat(key.amount);
        const amountToRecover = args.partialAmount || currentAmount;

        if (amountToRecover > currentAmount) throw new Error("Le montant demandé dépasse le solde du certificat.");
        if (currentAmount <= 0) throw new Error("Ce certificat est vide. Veuillez utiliser une autre clé.");

        // 1. Crédit du récupérateur
        const credit = await createTransaction({
            user: formatUser(user),
            typeCode: 'RW', 
            amount: amountToRecover,
            currency: key.currency,
            description: `Récupération ${args.partialAmount ? 'partielle ' : ''}de fonds USB`,
            metadata: { 
                hsm_recovery: true, 
                key_id: key.id, 
                signature: args.signature,
                issuerName: key.issuer_name,
                issuerWallet: key.issuer_wallet
            },
            status: 'Completed',
            connection
        });

        if (!credit.success) throw new Error(credit.error || "Échec du crédit des fonds sur votre portefeuille.");

        // 2. Mise à jour de la clé
        const remaining = currentAmount - amountToRecover;
        const newStatus = remaining <= 0 ? 'claimed' : 'partially_used';
        
        await connection.query(
            "UPDATE hardware_keys SET amount = $1, status = $2, claimed_at = $3, claimed_by_user_id = $4 WHERE id = $5", 
            [remaining, newStatus, remaining <= 0 ? new Date() : null, remaining <= 0 ? user.id : null, key.id]
        );
        
        await connection.query('COMMIT');

        return { success: true, amount: amountToRecover, currency: key.currency };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

/**
 * Récupère les signatures matérielles d'un utilisateur.
 */
export async function getHardwareSignatures(userId: number) {
    try {
        const { rows } = await db.query(
            `SELECT key_reference as reference, amount, currency, security_level, hsm_signature as signature, status, created_at as date, linked_card_id
             FROM hardware_keys 
             WHERE owner_user_id = $1 
             ORDER BY created_at DESC`,
            [userId]
        );
        return rows.map(row => ({
            ...row,
            amount: parseFloat(row.amount),
            date: format(new Date(row.date), 'dd MMMM yyyy HH:mm', { locale: fr })
        }));
    } catch (error) {
        return [];
    }
}

/**
 * Met à jour le PIN d'une clé matérielle.
 * Interdit pour les clés expirées ou vides.
 */
export async function updateHardwareKeyPin(signature: string, oldPin: string | null, newPin: string): Promise<{ success: boolean; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Identification requise." };

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows } = await connection.query(
            "SELECT id, pin_hash, security_level, status, amount FROM hardware_keys WHERE hsm_signature = $1 AND owner_user_id = $2 FOR UPDATE",
            [signature, user.id]
        );

        if (rows.length === 0) throw new Error("Clé introuvable ou vous n'êtes pas le propriétaire.");
        const key = rows[0];

        if (key.status === 'claimed' || parseFloat(key.amount) <= 0) throw new Error("Modification impossible : cette clé est déjà vidée ou encaissée.");

        if (key.security_level === 'pin_protected') {
            if (!oldPin) throw new Error("L'ancien PIN est requis.");
            const isMatch = await bcrypt.compare(oldPin, key.pin_hash);
            if (!isMatch) throw new Error("Ancien PIN incorrect.");
        }

        const newHash = await bcrypt.hash(newPin, 10);
        await connection.query(
            "UPDATE hardware_keys SET pin_hash = $1, security_level = 'pin_protected' WHERE id = $2",
            [newHash, key.id]
        );

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
 * Annule une signature et rembourse l'émetteur.
 * Interdit pour les clés déjà consommées.
 */
export async function cancelHardwareSignature(args: { reference: string; userId: number; pin: string; }): Promise<{ success: boolean; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user || user.id !== args.userId) return { success: false, error: 'Non autorisé.' };

    if (!user.pin_hash || !(await bcrypt.compare(args.pin, user.pin_hash))) {
        return { success: false, error: 'Code PIN de sécurité incorrect.' };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows } = await connection.query(
            "SELECT * FROM hardware_keys WHERE key_reference = $1 AND owner_user_id = $2 AND status NOT IN ('claimed', 'expired') FOR UPDATE",
            [args.reference, args.userId]
        );

        if (rows.length === 0) throw new Error("Clé introuvable, déjà utilisée ou déjà expirée.");
        const key = rows[0];

        const refund = await createTransaction({
            user: formatUser(user),
            typeCode: 'RW',
            amount: parseFloat(key.amount),
            currency: key.currency,
            description: `Annulation Signature USB (Réf: ${args.reference}) - Capital restitué`,
            metadata: { original_ref: args.reference, action: 'cancellation' },
            status: 'Completed',
            connection
        });

        if (!refund.success) throw new Error(refund.error || "Échec de la restitution des fonds.");

        await connection.query("UPDATE hardware_keys SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1", [key.id]);

        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function extractSignatureFromCpk(fileContent: string): Promise<{ success: boolean; signature?: string; isProtected?: boolean; error?: string }> {
    try {
        const signatureMatch = fileContent.match(/CLÉ H \(SIGNATURE\): ([a-f0-9]{64})/);
        const levelMatch = fileContent.match(/NIVEAU DE SÉCURITÉ: (.*)/);
        if (!signatureMatch) return { success: false, error: "Fichier .cpk corrompu ou invalide." };
        return { 
            success: true, 
            signature: signatureMatch[1], 
            isProtected: levelMatch ? levelMatch[1].includes('pin_protected') : false 
        };
    } catch (e) {
        return { success: false, error: "Erreur d'analyse du fichier .cpk." };
    }
}
