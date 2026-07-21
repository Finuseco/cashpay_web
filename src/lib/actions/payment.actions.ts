
'use server';

import { db } from '../db';
import { handleDbError } from './helpers';
import { generateReferenceCode, formatUser } from '../utils';
import { createTransaction } from './transaction.actions';
import { verifyCurrentUserPin } from './auth.actions';
import { createNotification } from './notification.actions';
import { sendEmail } from '@/services/email';
import type { User, PaymentDetails } from '../types';

/**
 * Récupère les détails d'un paiement marchand via son ID.
 */
export async function getPaymentDetails(paymentId: number): Promise<{ success: boolean; data?: PaymentDetails; error?: string }> {
    try {
        const { rows } = await db.query(`
            SELECT mp.*, u.full_name as "merchantName"
            FROM merchant_payments mp
            JOIN users u ON mp.merchant_id = u.id_wallet
            WHERE mp.id = $1
        `, [paymentId]);

        if (rows.length === 0) {
            return { success: false, error: "Demande de paiement introuvable." };
        }

        const row = rows[0];
        return {
            success: true,
            data: {
                amount: parseFloat(row.amount),
                currency: row.currency,
                description: row.description || `Paiement à ${row.merchantName}`,
                merchantName: row.merchantName,
                status: row.status,
                redirect_url: row.redirect_url
            }
        };
    } catch (error) {
        const dbError = await handleDbError(error, 'fetching payment details');
        return { success: false, error: dbError.error };
    }
}

/**
 * Traite un paiement par Compte CashPay (Interne).
 * Gère le débit réel du payeur et le crédit du bénéficiaire (propriétaire du lien ou marchand).
 */
export async function processCashPayAccountPayment(args: { 
    paymentId: number, 
    paymentLinkId?: number,
    userId: number, 
    amount: number,
    pin: string 
}): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Vérifier l'utilisateur payeur
        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [args.userId]);
        if (userRows.length === 0) throw new Error("Utilisateur introuvable.");
        const user = formatUser(userRows[0]);

        // 2. Vérifier le PIN de sécurité
        const isPinValid = await require('bcryptjs').compare(args.pin, userRows[0].pin_hash);
        if (!isPinValid) throw new Error("Code PIN incorrect.");

        let merchantUserId = null;
        let merchantWalletId = '';
        let description = 'Paiement Marchand';
        let currency = 'USD';

        // 3. Identification de la destination (Lien de Paiement ou Marchand Standard)
        if (args.paymentLinkId) {
            const { rows: linkRows } = await connection.query(
                `SELECT pl.*, u.id as "ownerId", u.id_wallet as "ownerWalletId", u.full_name as "ownerName", u.email as "ownerEmail" 
                 FROM payment_links pl 
                 JOIN users u ON pl.user_id = u.id 
                 WHERE pl.id = $1 FOR UPDATE`,
                [args.paymentLinkId]
            );
            
            if (linkRows.length === 0) throw new Error("Lien de paiement introuvable.");
            const link = linkRows[0];

            if (link.status === 'blocked') {
                throw new Error("Ce lien de paiement a été suspendu par notre service de sécurité.");
            }
            if (link.status === 'inactive') {
                throw new Error("Ce lien de paiement n'est plus actif.");
            }

            merchantUserId = link.ownerId;
            merchantWalletId = link.ownerWalletId;
            description = `Via Lien: ${link.title}`;
            currency = link.currency;

            // Mettre à jour le montant collecté sur le lien (Trace logistique)
            await connection.query(
                'UPDATE payment_links SET collected_amount = collected_amount + $1 WHERE id = $2',
                [args.amount, args.paymentLinkId]
            );

        } else {
            // Paiement marchand standard (via bouton "Payer" ou API externe)
            const { rows: payRows } = await connection.query(
                'SELECT mp.*, u.id as "ownerId" FROM merchant_payments mp JOIN users u ON mp.merchant_id = u.id_wallet WHERE mp.id = $1 AND mp.status = $2 FOR UPDATE', 
                [args.paymentId, 'pending']
            );
            
            if (payRows.length === 0) throw new Error("Paiement déjà traité ou introuvable.");
            const payment = payRows[0];
            
            merchantUserId = payment.ownerId;
            merchantWalletId = payment.merchant_id;
            description = `Paiement Marchand: ${payment.description || 'Achat'}`;
            currency = payment.currency;
            
            await connection.query("UPDATE merchant_payments SET status = 'completed', processed_at = NOW() WHERE id = $1", [args.paymentId]);
        }

        // 4. EXÉCUTION DE LA TRANSACTION FINANCIÈRE (DÉBIT/CRÉDIT RÉEL)
        // createTransaction gère l'atomicité des soldes et l'enregistrement dans 'transactions'
        const txResult = await createTransaction({
            user,
            typeCode: 'PAYMENT',
            amount: args.amount,
            currency: currency,
            description: description,
            receiver_id: merchantUserId,
            receiver_wallet_id: merchantWalletId,
            metadata: { 
                merchant_payment_id: args.paymentId, 
                payment_link_id: args.paymentLinkId,
                source: 'gateway_cashpay'
            },
            connection
        });

        if (!txResult.success) throw new Error(txResult.error || "Échec du transfert de fonds.");

        await connection.query('COMMIT');

        // 5. ALERTES ET NOTIFICATIONS (Post-Commit)
        if (args.paymentLinkId) {
            // Notification spécifique pour le propriétaire du lien
            const { rows: linkInfo } = await db.query(
                'SELECT title, u.full_name, u.email FROM payment_links pl JOIN users u ON pl.user_id = u.id WHERE pl.id = $1',
                [args.paymentLinkId]
            );
            
            if (linkInfo.length > 0) {
                const info = linkInfo[0];
                
                await createNotification(
                    merchantUserId,
                    'Encaissement via Lien',
                    `Vous avez reçu ${args.amount} ${currency} via votre lien "${info.title}" de la part de ${user.full_name}.`,
                    'general'
                );

                if (info.email) {
                    sendEmail(info.email, 'Paiement reçu via votre lien CashPay', 'general', {
                        title: 'Vente confirmée !',
                        greeting: `Bonjour ${info.full_name},`,
                        message: `Bonne nouvelle ! Vous venez de recevoir un paiement de <strong>${args.amount} ${currency}</strong> via votre lien : <strong>${info.title}</strong>.`,
                        buttonText: 'Gérer mes fonds',
                        buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment-links`,
                        signature: "L'équipe Souveraine CashPay"
                    }).catch(console.error);
                }
            }
        }

        return { success: true };

    } catch (error: any) {
        if (connection) await connection.query('ROLLBACK');
        console.error("[Process Payment Error]", error.message);
        return { success: false, error: error.message };
    } finally {
        if (connection) connection.release();
    }
}

export async function processGatewayCardPayment(args: any) {
    // Intégration avec service/paypal.ts ou stripe.ts
    return { success: true, message: "Traitement par carte en cours..." };
}

export async function processGatewayMobileMoneyPayment(args: any) {
    // Intégration avec service/maxicash.ts (PayIn)
    return { success: true, message: "Demande envoyée au téléphone." };
}
