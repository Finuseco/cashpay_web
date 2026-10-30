'use server';
import type {IntlSendArgs} from '@/lib/actions/transfer.actions';

export interface WesternUnionQuote {
    success: boolean;
    fees: number;
    exchangeRate: number;
    recipientReceives: number;
    error?: string;
}

export interface WesternUnionTransferDetails {
    success: boolean;
    status: 'unknown' | 'available' | 'paid' | 'cancelled';
    senderName: string;
    senderCountry: string;
    amount: number;
    currency: string;
    error?: string;
}

// No provider contract is configured here. Never generate names, amounts or payout references.
const unavailable = 'Vérification automatique Western Union indisponible. Soumettez une réclamation pour contrôle par une agence inter habilitée.';
export async function getWesternUnionQuote(amount:number,fromCurrency:string,toCountry:string):Promise<WesternUnionQuote> {
 return {success:false,fees:0,exchangeRate:0,recipientReceives:0,error:unavailable};
}
export async function trackWesternUnionTransfer(mtcn:string):Promise<WesternUnionTransferDetails> {
 return {success:false,status:'unknown',senderName:'',senderCountry:'',amount:0,currency:'',error:unavailable};
}
export async function sendMoney(args:IntlSendArgs):Promise<{success:boolean;transactionId?:string;error?:string}> {
 return {success:false,error:'Envoi automatique Western Union indisponible : aucun identifiant fournisseur ne sera simulé.'};
}
