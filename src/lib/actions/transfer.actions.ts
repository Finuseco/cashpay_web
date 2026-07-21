
      
'use server';

import type { User } from '@/lib/types';
import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import { createTransaction } from './transaction.actions';
import type { PoolClient } from 'pg';
import { sendMoney as sendWithWesternUnion } from '@/services/western-union';
import { sendMoney as sendWithMoneyGram } from '@/services/moneygram';
import { sendMoney as sendWithRia } from '@/services/ria';
import { sendMoney as sendWithMastercard } from '@/services/mastercard-send';
import { sendMoney as sendWithVisaDirect } from '@/services/visa-direct';
import { sendSms } from '@/services/sms';
import { disburse as disburseToMobileMoney } from '@/services/airtel';


interface IntlClaimArgs {
    user: User;
    provider: 'western_union' | 'moneygram' | 'ria';
    trackingNumber: string;
    senderCountry: string;
    amount: number;
    currency: string;
    receiveInCurrency: 'USD' | 'EUR' | 'CDF';
}

export async function submitTransferClaim(args: IntlClaimArgs): Promise<{ success: boolean; error?: string }> {
    const { user, provider, trackingNumber, senderCountry, amount, currency, receiveInCurrency } = args;

    if (!user || !user.id) {
        return { success: false, error: "Utilisateur non authentifié." };
    }

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Check if user has an identity document
        const { rows: docRows } = await connection.query('SELECT id FROM user_documents WHERE user_id = $1', [user.id]);
        if (docRows.length === 0) {
            throw new Error("Aucune pièce d'identité trouvée. Veuillez compléter votre profil.");
        }
        const userDocumentId = docRows[0].id;

        // 2. Check if this claim already exists and is not rejected
        const { rows: existingClaim } = await connection.query('SELECT status FROM international_transfer_claims WHERE tracking_number = $1 AND provider = $2 AND status != $3', [trackingNumber, provider, 'rejected']);
        if (existingClaim.length > 0) {
            throw new Error(`Une réclamation pour ce transfert est déjà en cours ou a été complétée (Statut: ${existingClaim[0].status}).`);
        }

        // 3. Insert the new claim
        const claimData = {
            user_id: user.id,
            provider,
            tracking_number: trackingNumber,
            expected_amount: amount,
            expected_currency: currency,
            sender_country: senderCountry,
            receive_in_currency: receiveInCurrency,
            status: 'pending',
            user_document_id: userDocumentId,
        };

        await connection.query('INSERT INTO international_transfer_claims (user_id, provider, tracking_number, expected_amount, expected_currency, sender_country, receive_in_currency, status, user_document_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', Object.values(claimData));
        await connection.query('COMMIT');

        // TODO: Notify admin/agents about the new claim.

        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'submitting international transfer claim');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

export interface IntlSendArgs {
    user: User;
    provider: 'western_union' | 'moneygram' | 'ria' | 'mastercard' | 'visa_direct' | 'mobile_money';
    recipientName: string;
    recipientCountry: string;
    recipientPhone?: string;
    recipientCardNumber?: string;
    mobileMoneyOperator?: 'airtel' | 'orange' | 'mpesa';
    amount: number;
    currency: string;
    fee: number;
    notifyRecipientSms: boolean;
}

export async function requestInternationalTransfer(args: IntlSendArgs): Promise<{ success: boolean; error?: string; reference?: string }> {
    const { user, provider, recipientName, recipientCountry, amount, currency, fee, recipientPhone, notifyRecipientSms } = args;
    const totalDebit = amount + fee;

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Debit user's account for the total amount
        const transactionResult = await createTransaction({
            user,
            typeCode: 'INTL_SEND',
            amount: totalDebit,
            currency: currency as 'USD' | 'EUR' | 'CDF',
            description: `Envoi ${provider} à ${recipientName}, ${recipientCountry}`,
            metadata: { provider, recipientName, recipientCountry, amount, fee }
        });

        if (!transactionResult.success || !transactionResult.transactionId) {
            throw new Error(transactionResult.error || "Le paiement pour le transfert a échoué.");
        }
        
        let automatedSendResult;
        if (provider === 'western_union') {
            automatedSendResult = await sendWithWesternUnion(args);
        } else if (provider === 'moneygram') {
            automatedSendResult = await sendWithMoneyGram(args);
        } else if (provider === 'ria') {
            automatedSendResult = await sendWithRia(args);
        } else if (provider === 'mastercard') {
            automatedSendResult = await sendWithMastercard(args);
        } else if (provider === 'visa_direct') {
            automatedSendResult = await sendWithVisaDirect(args);
        } else if (provider === 'mobile_money') {
            if (!args.mobileMoneyOperator || !args.recipientPhone) {
                throw new Error("L'opérateur Mobile Money et le numéro de téléphone sont requis.");
            }
            // Mobile money disbursement now uses the more generic disburseToMobileMoney
            automatedSendResult = await disburseToMobileMoney({
                amount: args.amount,
                currency: args.currency as 'USD' | 'CDF',
                recipientPhone: args.recipientPhone,
                reference: transactionResult.reference!,
                countryCode: args.recipientCountry,
                pin: process.env.AIRTEL_SYSTEM_PIN! // This needs a more secure handling
            });
        }


        const requestData = {
            user_id: user.id,
            provider,
            recipient_name: recipientName,
            recipient_country: recipientCountry,
            recipient_phone: recipientPhone,
            amount_to_send: amount,
            currency,
            fee_amount: fee,
            total_debited: totalDebit,
            status: automatedSendResult?.success ? 'completed' : 'pending',
            tracking_number: automatedSendResult?.transactionId, // Standardized to transactionId
            source_transaction_id: transactionResult.transactionId,
        };

        await connection.query('INSERT INTO international_transfer_requests (user_id, provider, recipient_name, recipient_country, recipient_phone, amount_to_send, currency, fee_amount, total_debited, status, tracking_number, source_transaction_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)', Object.values(requestData));
        await connection.query('COMMIT');

        if (automatedSendResult?.success && automatedSendResult.transactionId && notifyRecipientSms && recipientPhone) {
            const smsMessage = `Bonjour, ${user.full_name} vous a envoyé ${amount} ${currency} via ${provider}. Le code de retrait est : ${automatedSendResult.transactionId}.`;
            await sendSms(recipientPhone, smsMessage);
        }

        return { success: true, reference: automatedSendResult?.transactionId || transactionResult.reference };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'requesting international transfer');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

    