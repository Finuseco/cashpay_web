
'use server';

import type { User, Card, SavedCard } from '@/lib/types';
import { db } from '../db';
import { handleDbError, saveBase64Image, getUserFromDb } from './helpers';
import { createTransaction } from './transaction.actions';
import { 
    issueMarqetaCard, 
    createOrUpdateMarqetaUser, 
    transitionCardState,
    getSensitiveCardData,
    setCardPin as setMarqetaPin,
    getMarqetaCard,
    update3DSConfiguration,
    getInAppProvisioningData,
    updateMarqetaCard
} from '@/services/marqeta';
import { calculateTransactionFee } from './wallet.actions';
import { formatUser } from '../utils';
import config from '@/config';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { getAuthenticatedUser } from './user.actions';
import * as bcrypt from 'bcryptjs';
import { createNotification } from './notification.actions';

export interface CardRequest {
    id: number;
    card_type: 'physique';
    brand: 'visa' | 'mastercard';
    currency: string;
    status: 'pending' | 'ready_for_pickup' | 'completed';
    created_at: string;
}

/**
 * Gère l'émission d'une carte via Marqeta.
 */
export async function purchaseCard(args: { user: User, card_type: 'virtuelle' | 'physique', brand: 'visa' | 'mastercard', currency: string, pin: string }): Promise<{ success: boolean; error?: string }> {
    const { user, card_type, brand, currency, pin } = args;
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const productToken = card_type === 'virtuelle' 
            ? config.marqeta.productTokenVirtual 
            : config.marqeta.productTokenPhysical;

        if (!productToken) throw new Error(`Configuration Marqeta manquante pour le type ${card_type}.`);

        const feeTypeCode = `BUY_CARDS_${currency.toUpperCase()}_${card_type === 'virtuelle' ? 'V' : 'P'}_FEE`;
        const fee = await calculateTransactionFee(1, currency, feeTypeCode, null, connection);

        const tx = await createTransaction({
            user, typeCode: feeTypeCode, amount: fee, currency,
            description: `Achat carte ${card_type} ${brand.toUpperCase()}`,
            metadata: { card_type, brand, currency },
            connection,
        });

        if (!tx.success) throw new Error(tx.error || "Le prélèvement des frais d'émission a échoué.");
        
        const userToken = `user_cp_${user.id}`;
        await createOrUpdateMarqetaUser({
            token: userToken,
            firstName: user.first_name || '',
            lastName: user.last_name || '',
            email: user.email || ''
        });
        
        if (card_type === 'virtuelle') {
            const idempotencyKey = crypto.randomUUID();
            const marqetaCard = await issueMarqetaCard({ userToken, cardProductToken: productToken }, idempotencyKey);

            await connection.query(`
                INSERT INTO cards (user_id, card_provider_id, marqeta_user_token, marqeta_card_token, card_type, brand, currency, last4, exp_month, exp_year, status) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, 
                [user.id, marqetaCard.token, userToken, marqetaCard.token, 'virtuelle', brand, currency, marqetaCard.last_four, parseInt(marqetaCard.expiration_time.substring(5, 7)), parseInt(marqetaCard.expiration_time.substring(0, 4)), 'active']
            );
            
            const headerList = headers();
            const ipAddress = (headerList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
            await setMarqetaPin(marqetaCard.token, pin, crypto.randomUUID(), ipAddress);
            await update3DSConfiguration(marqetaCard.token, true);
        } else {
            await connection.query('INSERT INTO card_requests (user_id, card_type, brand, currency, status) VALUES ($1, $2, $3, $4, $5)', [user.id, card_type, brand, currency, 'pending']);
        }
        
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
 * Met à jour la source de dépense d'une carte.
 */
export async function updateSpendingSource(cardId: string, type: 'wallet' | 'cpk'): Promise<{ success: boolean; error?: string }> {
    try {
        await db.query('UPDATE cards SET spending_source_type = $1 WHERE id = $2', [type, cardId]);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Lie un certificat USB (.CPK) à une carte CashPay.
 * Gère la liaison cross-utilisateur avec notifications sécurisées.
 */
export async function linkCpkToCard(cardId: string, cpkSignature: string, cpkPin: string): Promise<{ success: boolean; error?: string }> {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Identification requise." };

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Trouver le certificat
        const { rows: keyRows } = await connection.query(
            `SELECT hk.*, u.full_name as owner_name, u.id_wallet as owner_wallet
             FROM hardware_keys hk
             JOIN users u ON hk.owner_user_id = u.id
             WHERE hk.hsm_signature = $1 AND hk.status NOT IN ('claimed', 'cancelled', 'expired') FOR UPDATE`,
            [cpkSignature]
        );

        if (keyRows.length === 0) throw new Error("Certificat CPK introuvable, déjà utilisé ou expiré.");
        const key = keyRows[0];

        // 2. Vérifier la devise (Doit correspondre à la carte)
        const { rows: cardRows } = await connection.query('SELECT currency FROM cards WHERE id = $1', [cardId]);
        if (cardRows.length === 0) throw new Error("Carte introuvable.");
        if (cardRows[0].currency !== key.currency) throw new Error(`Incohérence de devise : La carte est en ${cardRows[0].currency} mais la clé est en ${key.currency}.`);

        // 3. Vérifier le PIN de la clé (Autorisation du signataire original)
        if (key.pin_hash && !(await bcrypt.compare(cpkPin, key.pin_hash))) {
            throw new Error("Code PIN du certificat CPK incorrect. L'autorisation du détenteur est requise.");
        }

        // 4. Lier la clé et transférer le holder à l'utilisateur actuel
        await connection.query(
            'UPDATE hardware_keys SET linked_card_id = $1, owner_user_id = $2 WHERE hsm_signature = $3', 
            [cardId, user.id, cpkSignature]
        );
        
        // On s'assure que la carte est configurée pour utiliser les clés CPK
        await connection.query('UPDATE cards SET spending_source_type = $1 WHERE id = $2', ['cpk', cardId]);

        await connection.query('COMMIT');

        // 5. Notifications croisées
        const isExternal = key.owner_user_id !== user.id;

        // Notification nouveau détenteur
        await createNotification(user.id, "Certificat USB Lié", `Votre certificat de ${key.amount} ${key.currency} est maintenant actif sur votre carte.`, "general");

        if (isExternal) {
            // Notification ancien propriétaire (Alerte Sécurité)
            await createNotification(
                key.owner_user_id, 
                "Alerte Sécurité : Clé liée à un tiers", 
                `Votre certificat (Réf: ${key.key_reference}) vient d'être lié à la carte de ${user.full_name}. Si vous n'êtes pas à l'origine de cette action, contactez le support.`, 
                "general"
            );
        }

        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

/**
 * Délie une clé CPK d'une carte.
 */
export async function unlinkCpkFromCard(cardId: string): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows: cardRows } = await connection.query('SELECT linked_cpk_id FROM cards WHERE id = $1', [cardId]);
        if (cardRows.length > 0 && cardRows[0].linked_cpk_id) {
            await connection.query('UPDATE hardware_keys SET linked_card_id = NULL WHERE hsm_signature = $1', [cardRows[0].linked_cpk_id]);
        }
        await connection.query('UPDATE cards SET linked_cpk_id = NULL, spending_source_type = $1 WHERE id = $2', ['wallet', cardId]);
        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function getCardById(cardId: string, userId: number): Promise<Card | null> {
    try {
        const { rows } = await db.query(`
            SELECT c.*, u.full_name
            FROM cards c 
            JOIN users u ON c.user_id = u.id 
            WHERE c.id = $1 AND c.user_id = $2`, [cardId, userId]);
        if (rows.length === 0) return null;

        const cardData = rows[0];
        const mCard = await getMarqetaCard(cardData.marqeta_card_token);

        // Fetch ALL linked hardware keys for this card
        const { rows: keyRows } = await db.query(
            "SELECT id, key_reference as reference, hsm_signature as signature, amount, currency, status FROM hardware_keys WHERE linked_card_id = $1",
            [cardId]
        );

        const { rows: walletRows } = await db.query('SELECT balances FROM wallets WHERE user_id = $1', [userId]);
        const balances = walletRows.length > 0 ? (typeof walletRows[0].balances === 'string' ? JSON.parse(walletRows[0].balances) : walletRows[0].balances) : {};

        return {
            ...cardData,
            id: cardData.id.toString(),
            holder: cardData.full_name,
            balance: parseFloat(balances[cardData.currency] || 0),
            spending_source_type: cardData.spending_source_type || 'wallet',
            linkedKeys: keyRows.map(k => ({
                ...k,
                amount: parseFloat(k.amount)
            })),
            status: mCard.state.toLowerCase() === 'active' ? 'active' : (mCard.state.toLowerCase() === 'suspended' ? 'inactive' : 'cancelled')
        };
    } catch (error) {
        return null;
    }
}

export async function getCardsForUser(userId: number, holderName: string): Promise<Card[]> {
    try {
        const { rows } = await db.query('SELECT * FROM cards WHERE user_id = $1 AND status != $2', [userId, 'cancelled']);
        return rows.map(row => ({ 
            ...row, 
            id: row.id.toString(), 
            holder: holderName, 
            balance: 0,
            spending_source_type: row.spending_source_type || 'wallet'
        }));
    } catch (error) {
        return [];
    }
}

export async function toggleCardStatus(cardId: string, status: 'active' | 'inactive'): Promise<{success: boolean, error?:string, card?: Card}> {
    try {
        const { rows } = await db.query('SELECT * FROM cards WHERE id = $1', [cardId]);
        if (rows.length === 0) return { success: false, error: 'Carte introuvable.' };
        const cardData = rows[0];
        
        await transitionCardState(
            cardData.marqeta_card_token, 
            status === 'active' ? 'ACTIVE' : 'SUSPENDED', 
            'Action utilisateur via CashPay App',
            '00'
        );
        
        await db.query('UPDATE cards SET status = $1 WHERE id = $2', [status, cardId]);
        const updatedCard = await getCardById(cardId, cardData.user_id);
        return { success: true, card: updatedCard as Card };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function terminateCard(cardId: string, userId: number, reasonCode: string = '00'): Promise<{ success: boolean; error?: string }> {
    try {
        const { rows } = await db.query('SELECT marqeta_card_token FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        if (rows.length === 0) return { success: false, error: 'Carte introuvable.' };
        
        const cardToken = rows[0].marqeta_card_token;
        await transitionCardState(cardToken, 'TERMINATED', 'Résiliation définitive demandée par l\'utilisateur', reasonCode);
        
        await db.query('UPDATE cards SET status = $1 WHERE id = $2', ['cancelled', cardId]);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function setCardPin(cardId: string, userId: number, pin: string): Promise<{ success: boolean; error?: string }> {
    const headerList = headers();
    const ipAddress = (headerList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();

    try {
        const { rows } = await db.query('SELECT marqeta_card_token FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        if (rows.length === 0) throw new Error("Carte non trouvée.");

        const idempotencyKey = crypto.randomUUID();
        await setMarqetaPin(rows[0].marqeta_card_token, pin, idempotencyKey, ipAddress);

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateCardMetadata(cardId: string, userId: number, nickname: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { rows } = await db.query('SELECT marqeta_card_token FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        if (rows.length === 0) throw new Error("Carte non trouvée.");

        const cardToken = rows[0].marqeta_card_token;
        await updateMarqetaCard(cardToken, { metadata: { nickname } });
        
        await db.query('UPDATE cards SET metadata = jsonb_set(COALESCE(metadata, \'{}\'), \'{nickname}\', $1) WHERE id = $2', [JSON.stringify(nickname), cardId]);

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getInAppProvisioningDataAction(cardId: string) {
    const headerList = headers();
    const userAgent = headerList.get('user-agent') || '';
    const deviceType = userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'APPLE_PAY' : 'GOOGLE_PAY';

    try {
        const { rows } = await db.query('SELECT marqeta_card_token FROM cards WHERE id = $1', [cardId]);
        if (rows.length === 0) throw new Error("Carte non trouvée.");

        const data = await getInAppProvisioningData(rows[0].marqeta_card_token, deviceType as any, 'device_id_placeholder');
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getCardRequestsForUser(userId: number): Promise<CardRequest[]> {
    try {
        const { rows } = await db.query('SELECT * FROM card_requests WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return rows as CardRequest[];
    } catch (error) {
        return [];
    }
}

export async function revealCardDetails(cardId: string, userId: number): Promise<{ success: boolean; number?: string; cvv?: string; error?: string }> {
    try {
        const { rows } = await db.query('SELECT marqeta_card_token FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        if (rows.length === 0) throw new Error("Carte non trouvée.");
        const data = await getSensitiveCardData(rows[0].marqeta_card_token);
        return { success: true, number: data.pan, cvv: data.cvv2 };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function transferBetweenCards(args: { user: User, fromCardId: string, toCardId: string, amount: number }): Promise<{ success: boolean; error?: string }> {
    const { user, fromCardId, toCardId, amount } = args;
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');
        const { rows: fromRows } = await connection.query('SELECT * FROM cards WHERE id = $1 AND user_id = $2', [fromCardId, user.id]);
        const { rows: toRows } = await connection.query('SELECT * FROM cards WHERE id = $1 AND user_id = $2', [toCardId, user.id]);
        if (fromRows.length === 0 || toRows.length === 0) throw new Error("Une des cartes est introuvable.");
        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function requestCardDeletion(cardId: string, userId: number): Promise<{ success: boolean; error?: string }> {
    try {
        await db.query('UPDATE cards SET status = $1 WHERE id = $2 AND user_id = $3', ['pending_cancellation', cardId, userId]);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getSavedUserCards(userId: number): Promise<SavedCard[]> {
    try {
        const { rows } = await db.query('SELECT * FROM saved_cards WHERE user_id = $1', [userId]);
        return rows as SavedCard[];
    } catch (error) {
        return [];
    }
}

export async function updateSavedCardDetails(cardId: number) {
    return { success: true, message: 'Les détails de la carte ont été mis à jour.' };
}

export async function deleteLinkedAccount(userId: number, cardId: number) {
    try {
        await db.query('DELETE FROM saved_cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        const accounts = await getSavedUserCards(userId);
        return { success: true, accounts };
    } catch(e) {
        return { success: false, error: "Échec de la suppression." };
    }
}

export async function activatePhysicalCard(cardId: string, userId: number): Promise<{ success: boolean; card?: Card; error?: string }> {
    try {
        const { rows } = await db.query('SELECT * FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        if (rows.length === 0) return { success: false, error: 'Carte introuvable.' };
        
        const cardToken = rows[0].marqeta_card_token;
        await transitionCardState(cardToken, 'ACTIVE', 'Activation manuelle par l\'utilisateur', '00');
        
        await db.query('UPDATE cards SET status = $1 WHERE id = $2', ['active', cardId]);
        const updatedCard = await getCardById(cardId, userId);
        return { success: true, card: updatedCard as Card };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
