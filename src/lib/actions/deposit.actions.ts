
'use server';

import type { User } from '@/lib/types';
import { createTransaction } from './transaction.actions';
import { generateReferenceCode, countryToCode } from '../utils';
import { processMaxiCashMobilePayment, processMaxiCashCardPayment } from '@/services/maxicash';

/**
 * Initie un dépôt Mobile Money via l'infrastructure sécurisée CashPay.
 */
export async function initiateDeposit(args: { 
    user: User, 
    amount: number, 
    currency: string, 
    phoneNumber: string, 
    operator: string 
}) {
    const { user, amount, currency, phoneNumber, operator } = args;
    const reference = generateReferenceCode('DEP_MOB');

    try {
        const sanitizedPhone = phoneNumber.replace('+', '').trim();

        const result = await processMaxiCashMobilePayment({
            amount,
            currency: currency.toUpperCase(),
            phoneNumber: sanitizedPhone,
            operator,
            reference,
            countryCode: countryToCode(user.country) || 'CD',
            user
        });

        if (result.success) {
            await createTransaction({
                user,
                typeCode: 'DP',
                amount,
                currency,
                description: `Dépôt Mobile Money direct via ${operator}`,
                metadata: { 
                    network_operator: operator, 
                    phone: sanitizedPhone, 
                    reference,
                    provider_tx_id: result.data?.transactionId
                },
                status: 'Pending',
                referenceCode: reference
            });

            return { 
                success: true, 
                message: "Demande de paiement envoyée. Veuillez valider sur votre téléphone." 
            };
        } else {
            return { success: false, error: result.message || "Échec de l'initiation du paiement mobile." };
        }
    } catch (e: any) {
        return { success: false, error: "Erreur de communication avec le réseau de paiement." };
    }
}

/**
 * Initie un dépôt par Carte Bancaire via l'infrastructure sécurisée CashPay.
 */
export async function initiateCardDeposit(args: { 
    user: User, 
    amount: number, 
    currency: string, 
    cardNumber: string, 
    expiryDate: string, 
    cvv: string, 
    cardHolderName: string 
}) {
    const { user, amount, currency, cardNumber, expiryDate, cvv, cardHolderName } = args;
    const reference = generateReferenceCode('DEP_CRD');
    
    const dateParts = expiryDate.split('/');
    if (dateParts.length !== 2) return { success: false, error: "Format d'expiration invalide (MM/AA)." };
    
    const month = dateParts[0].padStart(2, '0');
    const year = `20${dateParts[1]}`;

    try {
        const result = await processMaxiCashCardPayment({
            amount,
            currency: currency.toUpperCase(),
            cardNumber: cardNumber.replace(/\s+/g, ''),
            expiryMonth: month,
            expiryYear: year,
            cvv,
            cardHolder: cardHolderName,
            reference,
            user
        });

        if (result.success) {
            await createTransaction({
                user,
                typeCode: 'DP_CARD',
                amount,
                currency,
                description: `Approvisionnement par Carte Bancaire`,
                metadata: { 
                    last4: cardNumber.slice(-4), 
                    reference,
                    provider_tx_id: result.data?.transactionId 
                },
                status: 'Completed',
                referenceCode: reference
            });

            return { success: true, message: "Votre carte a été débitée et votre portefeuille crédité avec succès." };
        } else {
            return { success: false, error: result.message || "La transaction a été refusée par l'émetteur de la carte." };
        }
    } catch (e: any) {
        return { success: false, error: "Une erreur est survenue lors de l'autorisation de la carte." };
    }
}

/**
 * PayPal (Email-based deposit).
 */
export async function initiatePayPalDeposit(args: { user: User, amount: number, currency: string }): Promise<{ success: boolean; redirectUrl?: string; error?: string; message?: string }> {
    return { 
        success: true, 
        redirectUrl: `https://www.paypal.com/checkoutnow?token=mock_token_${Date.now()}` 
    };
}

/**
 * UBA Virtual Account.
 */
export async function initiateUbaVirtualAccountDeposit(args: any) {
    return { 
        success: true, 
        data: { 
            accountNumber: "9901234567", 
            bankName: "UBA Bank", 
            accountName: "CashPay Direct",
            amount: args.amount,
            currency: args.currency
        } 
    };
}
