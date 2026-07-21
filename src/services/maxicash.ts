
'use server';

import crypto from 'crypto';
import type { User } from '@/lib/types';

/**
 * @fileoverview Service de communication avec l'API Server-to-Server MaxiCash.
 * Centralise les encaissements (PayIn) et les décaissements (PayOut).
 * Documentation officielle : https://developer.maxicashme.com/
 */

const MERCHANT_ID = process.env.MAXICASH_MERCHANT_ID;
const MERCHANT_PASSWORD = process.env.MAXICASH_MERCHANT_PASSWORD;
const API_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.maxicashme.com/Merchant/api.asmx'
    : 'https://api-testbed.maxicashme.com/Merchant/api.asmx';

interface PaymentHashArgs {
    reference: string;
    amount: string;
}

/**
 * Génère le hash de vérification (SHA256) requis par MaxiCash.
 * Format : MerchantID + MerchantPassword + Reference + Amount
 */
export async function getPaymentHash(args: PaymentHashArgs): Promise<string> {
    if (!MERCHANT_ID || !MERCHANT_PASSWORD) {
        throw new Error("Identifiants de paiement non configurés.");
    }
    const { reference, amount } = args;
    const dataToHash = `${MERCHANT_ID}${MERCHANT_PASSWORD}${reference}${amount}`;
    return crypto.createHash('sha256').update(dataToHash, 'latin1').digest('hex');
}

/**
 * Mappe l'identifiant interne de l'opérateur et le pays vers le code technique MaxiCash.
 */
function mapProvider(operator: string, countryCode: string): string {
    const code = (countryCode || 'CD').toUpperCase();
    const op = operator.toLowerCase();

    const mapping: Record<string, Record<string, string>> = {
        'CD': {
            'mpesa': 'mpesa-rdc',
            'orange': 'orange-money-rdc',
            'airtel': 'airtel-money-rdc',
            'afrimoney': 'afrimoney-rdc',
            'mtn': 'mtn-rdc'
        },
        'CG': {
            'mtn': 'mtn-congo',
            'airtel': 'airtel-congo'
        },
        'GA': {
            'airtel': 'airtel-gabon',
            'moov': 'moov-gabon'
        },
        'SN': {
            'orange': 'orange-money-senegal',
            'free': 'free-money-senegal'
        },
        'CI': {
            'mtn': 'mtn-cote-ivoire',
            'moov': 'moov-cote-ivoire',
            'orange': 'orange-money-cote-ivoire'
        },
        'BJ': {
            'mtn': 'mtn-benin',
            'moov': 'moov-benin'
        },
        'CM': {
            'mtn': 'mtn-cameroun',
            'orange': 'orange-money-cameroun'
        }
    };

    return mapping[code]?.[op] || `${op}-${code.toLowerCase()}`;
}

/**
 * Traite un paiement Mobile Money (C2B) via l'API Directe (PayIn).
 */
export async function processMaxiCashMobilePayment(args: {
    amount: number;
    currency: string;
    phoneNumber: string;
    operator: string;
    reference: string;
    countryCode: string;
    user?: User;
}): Promise<{ success: boolean; data?: any; message?: string }> {
    if (!MERCHANT_ID || !MERCHANT_PASSWORD) return { success: false, message: "Service en maintenance." };

    const { amount, currency, reference, phoneNumber, operator, countryCode, user } = args;
    const amountStr = amount.toFixed(2);
    const provider = mapProvider(operator, countryCode);

    try {
        const payVerifyHash = await getPaymentHash({ reference, amount: amountStr });

        const soapRequestBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <PayIn xmlns="http://www.maxicashme.com/Api">
      <PayType>mobile</PayType>
      <MerchantID>${MERCHANT_ID}</MerchantID>
      <MerchantPassword>${MERCHANT_PASSWORD}</MerchantPassword>
      <Amount>${amountStr}</Amount>
      <Currency>${currency}</Currency>
      <Ref>${reference}</Ref>
      <PayVerifyHash>${payVerifyHash}</PayVerifyHash>
      <ClientName>${user?.full_name || 'Client CashPay'}</ClientName>
      <ClientEmail>${user?.email || 'noreply@cashpay-all.com'}</ClientEmail>
      <ClientTelephone>${user?.phone || phoneNumber}</ClientTelephone>
      <PhoneNumber>${phoneNumber}</PhoneNumber>
      <Provider>${provider}</Provider>
    </PayIn>
  </soap:Body>
</soap:Envelope>`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': '"http://www.maxicashme.com/Api/PayIn"'
            },
            body: soapRequestBody
        });
        
        const responseText = await response.text();
        const statusCodeMatch = responseText.match(/<StatusCode>(.*?)<\/StatusCode>/);
        const statusMessageMatch = responseText.match(/<StatusMessage>(.*?)<\/StatusMessage>/);
        const transactionIdMatch = responseText.match(/<TransactionID>(.*?)<\/TransactionID>/);
        
        if (statusCodeMatch?.[1] === '000') {
            return {
                success: true,
                message: "Demande envoyée au téléphone.",
                data: { transactionId: transactionIdMatch?.[1] }
            };
        }

        return { 
            success: false, 
            message: statusMessageMatch?.[1] || "Échec de l'initiation du paiement." 
        };

    } catch (error: any) {
        return { success: false, message: "Erreur de communication avec le réseau." };
    }
}

/**
 * Traite un décaissement (Payout) vers Mobile Money (B2C).
 */
export async function processMaxiCashPayout(args: {
    amount: number;
    currency: string;
    recipientPhone: string;
    operator: string;
    countryCode: string;
    reference: string;
    beneficiaryName: string;
    user: User;
}): Promise<{ success: boolean; data?: any; message?: string }> {
    if (!MERCHANT_ID || !MERCHANT_PASSWORD) return { success: false, message: "Service non disponible." };

    const { amount, currency, recipientPhone, operator, countryCode, reference, beneficiaryName, user } = args;
    const amountStr = amount.toFixed(2);
    const provider = mapProvider(operator, countryCode);

    try {
        const payVerifyHash = await getPaymentHash({ reference, amount: amountStr });

        const soapRequestBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <PayOut xmlns="http://www.maxicashme.com/Api">
      <MerchantID>${MERCHANT_ID}</MerchantID>
      <MerchantPassword>${MERCHANT_PASSWORD}</MerchantPassword>
      <Amount>${amountStr}</Amount>
      <Currency>${currency}</Currency>
      <Ref>${reference}</Ref>
      <PayVerifyHash>${payVerifyHash}</PayVerifyHash>
      <ClientName>${user.full_name}</ClientName>
      <ClientEmail>${user.email || 'noreply@cashpay-all.com'}</ClientEmail>
      <ClientTelephone>${user.phone || ''}</ClientTelephone>
      <BeneficiaryName>${beneficiaryName}</BeneficiaryName>
      <BeneficiaryEmail>noreply@cashpay-all.com</BeneficiaryEmail>
      <BeneficiaryTelephone>${recipientPhone}</BeneficiaryTelephone>
      <PhoneNumber>${recipientPhone}</PhoneNumber>
      <Provider>${provider}</Provider>
    </PayOut>
  </soap:Body>
</soap:Envelope>`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': '"http://www.maxicashme.com/Api/PayOut"'
            },
            body: soapRequestBody
        });

        const responseText = await response.text();
        const statusCodeMatch = responseText.match(/<StatusCode>(.*?)<\/StatusCode>/);
        const statusMessageMatch = responseText.match(/<StatusMessage>(.*?)<\/StatusMessage>/);
        const transactionIdMatch = responseText.match(/<TransactionID>(.*?)<\/TransactionID>/);

        if (statusCodeMatch?.[1] === '000') {
            return {
                success: true,
                message: "Virement Mobile Money effectué.",
                data: { transactionId: transactionIdMatch?.[1] }
            };
        }

        return { 
            success: false, 
            message: statusMessageMatch?.[1] || "Le virement a été refusé par le réseau." 
        };

    } catch (error: any) {
        return { success: false, message: "Erreur de connexion au centre de décaissement." };
    }
}
