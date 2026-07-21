

'use server';

import { createTransaction } from './transaction.actions';
import type { User } from '@/lib/types';
import { sendSms } from '@/services/sms';
import { getUserFromDb } from './helpers';
import { sendAndStoreOtp } from './auth.actions';
import { requestToPay, sendRemittance as sendAirtimeViaAirtel } from '@/services/airtel'; // Renamed and also importing requestToPay
import { verifyCurrentUserPin } from './auth.actions';
import { getExchangeRatesForCountry } from './exchange.actions';
import { countryToCode } from '../utils';


export async function initiateClientAirtimePurchase(args: { clientWalletId: string; amount: number; agentName: string; }) {
  const { clientWalletId, amount, agentName } = args;
  console.log('--- Initiate Client Airtime Purchase ---');

  const client = await getUserFromDb({ walletId: clientWalletId });
  if (!client) {
    return { success: false, error: 'Client non trouvé.' };
  }

  // Send OTP
  const otpResult = await sendAndStoreOtp(client.id, `un achat de crédit de ${amount} USD`, 'sms');

  return otpResult;
}

export async function confirmClientAirtimePurchase(args: { clientWalletId: string; otp: string; phoneNumber: string; operator: string; amount: number; }) {
    const { clientWalletId, otp, phoneNumber, operator, amount } = args;

    console.log('--- Confirm Client Airtime Purchase ---');
    console.log(`Verifying OTP ${otp} for client ${clientWalletId}`);

    if (otp !== '123456') { // Mock OTP check, replace with DB verification
        return { success: false, error: 'Le code de vérification est incorrect.' };
    }
    console.log('OTP Verified.');

    const client = await getUserFromDb({ walletId: clientWalletId });
    if (!client) {
        return { success: false, error: 'Client non trouvé.' };
    }
    
    // Debit Client
    const transactionResult = await createTransaction({
        user: client,
        typeCode: 'AB',
        amount: amount,
        currency: 'USD',
        description: `Achat de crédit ${operator} pour ${phoneNumber}`,
        metadata: { operator, phoneNumber }
    });

    if (!transactionResult.success) {
        return { success: false, error: transactionResult.error || 'Échec de la facturation du client.' };
    }

    // Send Airtime
    try {
        const airtimeResult = await sendAirtimeViaAirtel({
            recipientPhone: phoneNumber,
            amount,
            currency: 'USD',
            reference: transactionResult.reference!,
            pin: process.env.AIRTEL_SYSTEM_PIN!,
            countryCode: client.country
        }); 
        if (!airtimeResult.success) {
            console.error(`Airtime sending failed after debiting client: ${airtimeResult.message}`);
            // TODO: Implement transaction reversal logic here
            return { success: false, error: `La transaction a été facturée, mais l'envoi de crédit a échoué: ${airtimeResult.message}` };
        }
        return { success: true };
    } catch (error: any) {
        console.error("Critical error in confirmClientAirtimePurchase:", error);
        return { success: false, error: `Une erreur critique est survenue: ${error.message}` };
    }
}

interface AgentPurchaseAirtimeArgs {
  agent: User;
  agentPin: string;
  phoneNumber: string;
  operator: string;
  amount: number;
}

export async function agentPurchaseAirtime(args: AgentPurchaseAirtimeArgs) {
  const { agent, agentPin, phoneNumber, operator, amount } = args;
  
  if (!agent) {
      return { success: false, error: "Impossible de vérifier l'agent." };
  }

  // 1. Verify Agent's PIN
  const pinVerification = await verifyCurrentUserPin(agentPin);
  if (!pinVerification.success) {
      return { success: false, error: pinVerification.error };
  }
  
  // 2. Debit Agent's Account
  const transactionResult = await createTransaction({
    user: agent,
    typeCode: 'AB_AGENT', // Differentiate agent-led purchase
    amount: amount,
    currency: 'USD',
    description: `Vente directe de crédit ${operator} pour ${phoneNumber}`,
    metadata: { agentId: agent.id, operator, phoneNumber }
  });

  if (!transactionResult.success) {
    return { success: false, error: transactionResult.error || 'Échec de la facturation de l\'agent.' };
  }

  // 3. Send Airtime via external API using the new dedicated function
  try {
    const airtimeResult = await sendAirtimeViaAirtel({
      recipientPhone: phoneNumber,
      amount,
      currency: 'USD',
      reference: transactionResult.reference!,
      pin: agentPin, // Pass the real agent PIN for encryption
      countryCode: agent.country
    });

    if (!airtimeResult.success) {
      // Reversal logic would be here
      console.error(`Airtime sending failed after debiting agent: ${airtimeResult.message}`);
      return { success: false, error: `Votre compte a été débité, mais l'envoi de crédit a échoué: ${airtimeResult.message}. Référence: ${transactionResult.reference}` };
    }
    return { success: true };
    
  } catch (error: any) {
    console.error("Critical error in agentPurchaseAirtime:", error);
    return { success: false, error: `Une erreur critique est survenue: ${error.message}` };
  }
}


interface PurchaseAirtimeClientArgs {
  user: User;
  phoneNumber: string;
  operator: string;
  amountUSD: number;
  paymentCurrency: string;
}

export async function purchaseAirtime(args: PurchaseAirtimeClientArgs): Promise<{ success: boolean; message?: string, error?: string }> {
  const { user, phoneNumber, operator, amountUSD, paymentCurrency } = args;
  let debitAmount = amountUSD;
  let exchangeRate = null;

  if (paymentCurrency !== 'USD') {
    const userCountryCode = user.country ? countryToCode(user.country) : null;
    const rates = await getExchangeRatesForCountry(userCountryCode);
    const rateObject = rates.find(r => r.from_currency === 'USD' && r.to_currency === paymentCurrency);
    if (!rateObject) {
      return { success: false, error: `Taux de change pour ${paymentCurrency} non disponible.` };
    }
    exchangeRate = rateObject.rate;
    debitAmount = amountUSD * exchangeRate;
  }
  
  const transactionResult = await createTransaction({
    user: user,
    typeCode: 'AB',
    amount: debitAmount,
    currency: paymentCurrency,
    description: `Achat de crédit ${operator} de ${amountUSD} USD pour ${phoneNumber}`,
    metadata: { operator, phoneNumber, self_purchase: true, amountUSD, exchangeRate },
  });

  if (!transactionResult.success || !transactionResult.reference) {
    return { success: false, error: transactionResult.error || 'Échec de la facturation. Votre compte n\'a pas pu être débité.' };
  }

  try {
    const airtimeResult = await sendAirtimeViaAirtel({
      recipientPhone: phoneNumber,
      amount: amountUSD,
      currency: 'USD',
      reference: transactionResult.reference!,
      pin: process.env.AIRTEL_SYSTEM_PIN!,
      countryCode: user.country
    });

    if (!airtimeResult.success) {
      // TODO: Reversal logic
      console.error(`Airtime sending failed after debiting user: ${airtimeResult.message}`);
      return { success: false, error: `Votre compte a été débité, mais l'envoi de crédit a échoué: ${airtimeResult.message}.` };
    }
    
    // SMS confirmation
    if(user.phone) {
        await sendSms(user.phone, `CashPay: Votre recharge de ${amountUSD} USD vers ${phoneNumber} a réussi. Réf: ${transactionResult.reference}`);
    }

    return { success: true, message: "Achat de crédit réussi." };

  } catch (error: any) {
    console.error("Critical error in purchaseAirtime:", error);
    return { success: false, error: `Une erreur critique est survenue: ${error.message}` };
  }
}
