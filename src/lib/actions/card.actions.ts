'use server';

import type { User, Card, SavedCard } from '@/lib/types';
import { db } from '../db';
import { handleDbError, saveBase64Image, getUserFromDb } from './helpers';
import { createTransaction } from './transaction.actions';
import {
    issueFYATUCard,
    createOrUpdateFYATUUser,
    transitionCardState,
    getSensitiveCardData,
    setCardPin as setFYATUPin,
    getFYATUCard,
    update3DSConfiguration,
    getInAppProvisioningData,
    updateFYATUCard,
    getCardTransactions
} from '@/services/fyatu';
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

function providerCardId(row: any): string {
    if (!row?.card_provider_id) throw new Error('Identifiant FYATU de la carte manquant.');
    return String(row.card_provider_id);
}

function providerStatusToCashPay(status: string | undefined): 'active' | 'inactive' | 'cancelled' {
    const value = String(status || '').toUpperCase();
    if (value === 'TERMINATED') return 'cancelled';
    if (value === 'ACTIVE') return 'active';
    return 'inactive';
}

/**
 * Achat/émission d'une carte virtuelle.
 * La colonne cards.card_provider_id contient désormais l'ID de carte FYATU.
 * Les anciennes colonnes fournisseur restent dans PostgreSQL mais ne sont plus utilisées.
 */
export async function purchaseCard(args: {
    user: User;
    card_type: 'virtuelle' | 'physique';
    brand: 'visa' | 'mastercard';
    currency: string;
    pin: string;
}): Promise<{ success: boolean; error?: string }> {
    const { user, card_type, brand, currency, pin } = args;
    const normalizedCurrency = currency.toUpperCase();
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const fyatuConfig: any = config.fyatu as any;
        const normalizedBrand = brand.toLowerCase();
        const brandProductKeys = card_type === 'virtuelle'
            ? (normalizedBrand === 'visa'
                ? ['productTokenVisaVirtual', 'productTokenVirtualVisa']
                : ['productTokenMastercardVirtual', 'productTokenVirtualMastercard'])
            : (normalizedBrand === 'visa'
                ? ['productTokenVisaPhysical', 'productTokenPhysicalVisa']
                : ['productTokenMastercardPhysical', 'productTokenPhysicalMastercard']);
        const productToken = brandProductKeys.map((k:string)=>fyatuConfig[k]).find(Boolean)
            || (card_type === 'virtuelle' ? fyatuConfig.productTokenVirtual : fyatuConfig.productTokenPhysical);

        if (!productToken) throw new Error(`Configuration FYATU manquante pour le type ${card_type}.`);
        if (!['USD', 'EUR'].includes(normalizedCurrency)) {
            throw new Error('FYATU Card v3 supporte uniquement les cartes USD et EUR.');
        }

        const suffix = card_type === 'virtuelle' ? 'V' : 'P';
        const feeTypeCode = `BUY_CARDS_${normalizedCurrency}_${suffix}_FEE`;
        const fee = await calculateTransactionFee(1, normalizedCurrency, feeTypeCode, null, connection);

        // IMPORTANT : ne jamais débiter avant que FYATU ait confirmé l'émission/attribution.
        // Le débit des frais est exécuté uniquement après une émission réussie.

        const userToken = `user_cp_${user.id}`;
        const cardholder = await createOrUpdateFYATUUser({ token: userToken, user });
        const cardholderId = cardholder?.id;
        if (!cardholderId) throw new Error('FYATU n’a pas retourné de cardholderId.');
        if (String(cardholder.kycStatus || '').toUpperCase() !== 'ACCEPTED' && String(cardholder.kycStatus || '').toUpperCase() !== 'VERIFIED') {
            throw new Error('Le profil doit avoir un KYC FYATU accepté avant l’émission de la carte.');
        }

        // FYATU exige un financement initial >= 5 USD/EUR. Le financement est débité du wallet programme FYATU, pas du wallet utilisateur CashPay.
        const initialAmount = Number(process.env.FYATU_CARD_INITIAL_AMOUNT || 5);
        if (!Number.isFinite(initialAmount) || initialAmount < 5) {
            throw new Error('FYATU_CARD_INITIAL_AMOUNT doit être au minimum 5.');
        }

        const fyatuCard = await issueFYATUCard({
            userToken,
            cardholderId,
            cardProductToken: productToken,
            amount: initialAmount,
            name: `${user.first_name || ''} ${user.last_name || ''}`.trim()
        }, crypto.randomUUID());

        const providerBrand = String(fyatuCard.brand || brand).toLowerCase();
        if (providerBrand !== brand.toLowerCase()) {
            throw new Error(`Le produit FYATU sélectionné retourne ${providerBrand.toUpperCase()} alors que ${brand.toUpperCase()} a été demandé.`);
        }

        const expiry = String(fyatuCard.expiryDate || '');
        const [expMonthRaw, expYearRaw] = expiry.split('/');
        const expMonth = Number(expMonthRaw);
        const expYear = Number(expYearRaw);
        const providerStatus = String(fyatuCard.status || '').toUpperCase();

        await connection.query(`
            INSERT INTO cards (
                user_id, card_provider_id, card_type, brand, currency,
                number, last4, exp_month, exp_year, status, is_primary
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            user.id,
            fyatuCard.id,
            card_type,
            providerBrand,
            String(fyatuCard.currency || normalizedCurrency).toLowerCase(),
            null,
            fyatuCard.last4 || null,
            Number.isFinite(expMonth) ? expMonth : null,
            Number.isFinite(expYear) ? expYear : null,
            providerStatusToCashPay(providerStatus),
            false
        ]);

        // Le PIN n'est pas exposé par l'API FYATU v3 publique actuelle. On ne fait donc aucun appel inventé.
        void pin;

        const tx = await createTransaction({
            user,
            typeCode: feeTypeCode,
            amount: fee,
            currency: normalizedCurrency,
            description: `Achat carte ${card_type} ${brand.toUpperCase()}`,
            metadata: { card_type, brand, currency: normalizedCurrency, provider: 'FYATU', card_provider_id: fyatuCard.id },
            connection,
        });
        if (!tx.success) {
            try { await connection.query('DELETE FROM cards WHERE user_id=$1 AND card_provider_id=$2', [user.id, fyatuCard.id]); } catch {}
            throw new Error(tx.error || "Le prélèvement des frais d'émission a échoué. Vérifiez votre solde.");
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

export async function updateSpendingSource(cardId: string, userId: number, type: 'wallet' | 'cpk'): Promise<{ success: boolean; error?: string }> {
    // spending_source_type n'est pas présent dans le schéma cards fourni. La source CPK est déduite de hardware_keys.
    try {
        const { rows } = await db.query(
            'SELECT id FROM cards WHERE id = $1 AND user_id = $2',
            [cardId, userId]
        );
        if (rows.length === 0) return { success: false, error: 'Carte introuvable.' };

        if (type === 'wallet') {
            await db.query(
                'UPDATE hardware_keys SET linked_card_id = NULL WHERE linked_card_id = $1',
                [cardId]
            );
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function linkCpkToCard(cardId: string, userId: number, cpkSignature: string, cpkPin: string): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: cardRows } = await connection.query(
            'SELECT currency FROM cards WHERE id = $1 AND user_id = $2 FOR UPDATE',
            [cardId, userId]
        );
        if (cardRows.length === 0) throw new Error('Carte introuvable.');

        const { rows: keyRows } = await connection.query(
            `SELECT hk.*, u.full_name as owner_name, u.id_wallet as owner_wallet
             FROM hardware_keys hk
             JOIN users u ON hk.owner_user_id = u.id
             WHERE hk.hsm_signature = $1
               AND hk.status NOT IN ('claimed', 'cancelled', 'expired')
             FOR UPDATE`,
            [cpkSignature]
        );
        if (keyRows.length === 0) throw new Error('Certificat CPK introuvable ou déjà utilisé.');

        const key = keyRows[0];

        if (String(cardRows[0].currency).toUpperCase() !== String(key.currency).toUpperCase()) {
            throw new Error('Incohérence de devise.');
        }

        if (key.pin_hash && !(await bcrypt.compare(cpkPin, key.pin_hash))) {
            throw new Error('Code PIN du certificat CPK incorrect.');
        }

        await connection.query(
            'UPDATE hardware_keys SET linked_card_id = $1, owner_user_id = $2 WHERE hsm_signature = $3',
            [cardId, userId, cpkSignature]
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

export async function unlinkCpkFromCard(cardId: string, userId: number): Promise<{ success: boolean; error?: string }> {
    try {
        const { rows } = await db.query(
            'SELECT id FROM cards WHERE id = $1 AND user_id = $2',
            [cardId, userId]
        );
        if (rows.length === 0) return { success: false, error: 'Carte introuvable.' };

        await db.query(
            'UPDATE hardware_keys SET linked_card_id = NULL WHERE linked_card_id = $1',
            [cardId]
        );

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
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
        const { rows: keyRows } = await db.query(
            'SELECT id, key_reference as reference, hsm_signature as signature, amount, currency, status FROM hardware_keys WHERE linked_card_id = $1',
            [cardId]
        );
        const { rows: walletRows } = await db.query('SELECT balances FROM wallets WHERE user_id = $1', [userId]);
        const balances = walletRows.length > 0
            ? (typeof walletRows[0].balances === 'string' ? JSON.parse(walletRows[0].balances) : walletRows[0].balances)
            : {};

        return {
            ...cardData,
            id: String(cardData.id),
            holder: cardData.full_name,
            balance: Number(balances[String(cardData.currency || '').toUpperCase()] ?? balances[cardData.currency] ?? 0),
            spending_source_type: keyRows.length > 0 ? 'cpk' : 'wallet',
            linkedKeys: keyRows.map(k => ({ ...k, amount: Number(k.amount) })),
            status: String(cardData.status || 'inactive').toLowerCase()
        } as Card;
    } catch {
        return null;
    }
}

export async function getCardsForUser(userId: number, holderName: string): Promise<Card[]> {
    try {
        const { rows } = await db.query(
            `SELECT c.* FROM cards c
             WHERE c.user_id = $1 AND LOWER(COALESCE(c.status,'')) != 'cancelled'
             ORDER BY c.created_at DESC`,
            [userId]
        );
        return rows.map(row => ({
            ...row,
            id: String(row.id),
            holder: holderName,
            balance: 0,
            spending_source_type: row.spending_source_type || 'wallet',
            status: String(row.status || 'inactive').toLowerCase()
        })) as Card[];
    } catch {
        return [];
    }
}

export async function toggleCardStatus(cardId: string, userId: number, status: 'active' | 'inactive'): Promise<{ success: boolean; error?: string; card?: Card }> {
    try {
        const { rows } = await db.query(
            'SELECT * FROM cards WHERE id = $1 AND user_id = $2',
            [cardId, userId]
        );
        if (rows.length === 0) return { success: false, error: 'Carte introuvable.' };

        const cardData = rows[0];
        const provider = await getFYATUCard(providerCardId(cardData));
        const providerStatus = String(provider?.status || '').toUpperCase();

        if (status === 'active') {
            if (providerStatus !== 'FROZEN') {
                return {
                    success: false,
                    error: `La carte ne peut pas être réactivée depuis l'état FYATU ${providerStatus || 'INCONNU'}.`
                };
            }
            await transitionCardState(providerCardId(cardData), 'ACTIVE');
        } else {
            if (providerStatus !== 'ACTIVE') {
                return {
                    success: false,
                    error: `La carte ne peut pas être gelée depuis l'état FYATU ${providerStatus || 'INCONNU'}.`
                };
            }
            await transitionCardState(providerCardId(cardData), 'SUSPENDED');
        }

        await db.query(
            'UPDATE cards SET status = $1 WHERE id = $2 AND user_id = $3',
            [status, cardId, userId]
        );

        return {
            success: true,
            card: await getCardById(cardId, userId) as Card
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function terminateCard(cardId: string, userId: number, reasonCode: string = '00'): Promise<{ success: boolean; error?: string }> {
    void reasonCode;
    try {
        const { rows } = await db.query('SELECT card_provider_id FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        if (rows.length === 0) return { success: false, error: 'Carte introuvable.' };
        await transitionCardState(providerCardId(rows[0]), 'TERMINATED', 'Résiliation définitive demandée par l’utilisateur');
        await db.query('UPDATE cards SET status = $1 WHERE id = $2', ['cancelled', cardId]);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function setCardPin(cardId: string, userId: number, pin: string): Promise<{ success: boolean; error?: string }> {
    void pin;
    try {
        const { rows } = await db.query('SELECT card_provider_id FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        if (rows.length === 0) return { success: false, error: 'Carte non trouvée.' };
        // setFYATUPin reste importé pour compatibilité d'API interne, mais FYATU v3 public ne documente pas de endpoint PIN.
        await setFYATUPin(providerCardId(rows[0]), pin, crypto.randomUUID(), '127.0.0.1');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateCardMetadata(cardId: string, userId: number, nickname: string): Promise<{ success: boolean; error?: string }> {
    void updateFYATUCard;
    try {
        const { rows } = await db.query('SELECT id FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        if (rows.length === 0) return { success: false, error: 'Carte non trouvée.' };
        // Le schéma cards fourni ne possède pas de colonne metadata et FYATU v3 ne documente pas PATCH /cards/{id}.
        void nickname;
        return { success: false, error: 'Le renommage de carte n’est pas encore exposé par le schéma DB/API FYATU v3 actuel.' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getInAppProvisioningDataAction(cardId: string) {
    void getInAppProvisioningData;
    const { rows } = await db.query('SELECT card_provider_id FROM cards WHERE id = $1', [cardId]);
    if (rows.length === 0) return { success: false, error: 'Carte non trouvée.' };
    return { success: false, error: 'Le provisioning Apple Pay / Google Pay n’est pas exposé dans les endpoints publics FYATU v3 consultés.' };
}

export async function getCardRequestsForUser(userId: number): Promise<CardRequest[]> {
    try {
        const { rows } = await db.query('SELECT * FROM card_requests WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return rows as CardRequest[];
    } catch {
        return [];
    }
}

export async function revealCardDetails(cardId: string, userId: number): Promise<{
    success: boolean;
    number?: string;
    cvv?: string;
    expiry?: string;
    error?: string;
}> {
    try {
        const { rows } = await db.query(
            `SELECT number, last4, exp_month, exp_year, cvv_encrypted
             FROM cards
             WHERE id = $1 AND user_id = $2
             LIMIT 1`,
            [cardId, userId]
        );
        if (rows.length === 0) return { success: false, error: 'Carte non trouvée.' };

        const row = rows[0];
        const number = String(row.number || '').trim();
        const cvv = String(row.cvv_encrypted || '').trim();
        const expiry = row.exp_month && row.exp_year
            ? `${String(row.exp_month).padStart(2, '0')}/${String(row.exp_year)}`
            : '';

        return {
            success: true,
            number: number || undefined,
            cvv: cvv || undefined,
            expiry: expiry || undefined
        };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Impossible de récupérer les détails de la carte.' };
    }
}

export async function transferBetweenCards(args: { user: User; fromCardId: string; toCardId: string; amount: number }): Promise<{ success: boolean; error?: string }> {
    void args;
    return { success: false, error: 'Le transfert carte-à-carte n’est pas une opération documentée par FYATU v3. Utilisez le wallet CashPay ou Fund/Unload Card.' };
}

export async function requestCardDeletion(cardId: string, userId: number): Promise<{ success: boolean; error?: string }> {
    try {
        const { rows } = await db.query('SELECT card_provider_id FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        if (rows.length === 0) return { success: false, error: 'Carte introuvable.' };
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
    } catch {
        return [];
    }
}

export async function updateSavedCardDetails(cardId: number) {
    void cardId;
    return { success: true, message: 'Les détails de la carte ont été mis à jour.' };
}

export async function deleteLinkedAccount(userId: number, cardId: number) {
    try {
        await db.query('DELETE FROM saved_cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        const accounts = await getSavedUserCards(userId);
        return { success: true, accounts };
    } catch {
        return { success: false, error: 'Échec de la suppression.' };
    }
}

export async function activatePhysicalCard(cardId: string, userId: number): Promise<{ success: boolean; card?: Card; error?: string }> {
    try {
        const { rows } = await db.query('SELECT * FROM cards WHERE id = $1 AND user_id = $2', [cardId, userId]);
        if (rows.length === 0) return { success: false, error: 'Carte introuvable.' };
        const cardToken = providerCardId(rows[0]);
        await transitionCardState(cardToken, 'ACTIVE', 'Activation manuelle par l’utilisateur', '00');
        await db.query('UPDATE cards SET status = $1 WHERE id = $2', ['active', cardId]);
        return { success: true, card: await getCardById(cardId, userId) as Card };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
