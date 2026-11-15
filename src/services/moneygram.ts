'use server';
import type {IntlSendArgs} from '@/lib/actions/transfer.actions';

export interface MoneyGramQuote {
    success: boolean;
    fees: number;
    exchangeRate: number;
    recipientReceives: number;
    error?: string;
}

export interface MoneyGramTransferDetails {
    success: boolean;
    status: 'unknown' | 'available' | 'paid' | 'cancelled' | 'in_progress';
    senderName: string;
    senderCountry: string;
    amount: number;
    currency: string;
    error?: string;
}

// No provider contract is configured here. Never generate names, amounts or payout references.
const unavailable = 'Vérification automatique MoneyGram indisponible. Soumettez une réclamation pour contrôle par une agence inter habilitée.';
export async function getMoneyGramQuote(amount:number,fromCurrency:string,toCountry:string):Promise<MoneyGramQuote> {
 return {success:false,fees:0,exchangeRate:0,recipientReceives:0,error:unavailable};
}
export async function trackMoneyGramTransfer(trackingNumber:string):Promise<MoneyGramTransferDetails> {
 return {success:false,status:'unknown',senderName:'',senderCountry:'',amount:0,currency:'',error:unavailable};
}
export async function sendMoney(args:IntlSendArgs):Promise<{success:boolean;transactionId?:string;error?:string}> {
 return {success:false,error:'Envoi automatique MoneyGram indisponible : aucun identifiant fournisseur ne sera simulé.'};
}
