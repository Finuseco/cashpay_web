
'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { User } from '@/lib/types';
import { createTransaction, reverseTransaction } from './transaction.actions';
import { executePayPalPayout } from '@/services/paypal';
import { verifyCurrentUserPin } from './auth.actions';
import { generateReferenceCode } from '../utils';

const PAYPAL_PAYOUT_LIMIT = 500;

/**
 * Traite une demande de retrait vers un compte PayPal Live.
 * Souveraineté : L'argent est débité et placé en séquestre.
 */
export async function requestPayPalPayout(args: { user: User, email: string, amount: number, currency: string, pin: string }) {
    const { user, email, amount, currency, pin } = args;

    if (amount > PAYPAL_PAYOUT_LIMIT) {
        return { success: false, error: `Le montant maximum pour un retrait PayPal est de ${PAYPAL_PAYOUT_LIMIT} USD.` };
    }

    const pinRes = await verifyCurrentUserPin(pin);
    if (!pinRes.success) return pinRes;

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const reference = generateReferenceCode('WD_PP');

        // 1. Débiter l'utilisateur et créditer le séquestre
        const tx = await createTransaction({
            user,
            typeCode: 'WD_PAYPAL',
            amount,
            currency,
            description: `Retrait vers compte PayPal (${email})`,
            metadata: { recipient_email: email, reference },
            status: 'Pending',
            connection
        });

        if (!tx.success) throw new Error(tx.error);

        // 2. Appel PayPal
        try {
            const payout = await executePayPalPayout(email, amount, currency, reference);
            
            await connection.query(
                'INSERT INTO transaction_audit (transaction_id, event, status, provider_response) VALUES ($1, $2, $3, $4)',
                [tx.transactionId, 'PAYOUT_INITIATED', 'PENDING', JSON.stringify(payout)]
            );

            await connection.query('COMMIT');
            return { success: true, message: "Votre demande de retrait a été transmise avec succès." };
        } catch (paypalError: any) {
            // Remboursement immédiat si l'appel API échoue avant même d'être traité par PayPal
            await connection.query('ROLLBACK');
            // Comme on a rollback, on doit recréer une connexion pour le reversal ou le gérer manuellement
            // Mais ici, le plus simple est de ne pas commiter le débit initial.
            return { success: false, error: `Erreur PayPal: ${paypalError.message}` };
        }

    } catch (error: any) {
        if (connection) await connection.query('ROLLBACK');
        return { success: false, error: error.message || "Échec de l'initiation du retrait." };
    } finally {
        connection.release();
    }
}
