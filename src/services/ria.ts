'use server';
import type {IntlSendArgs} from '@/lib/actions/transfer.actions';

export interface RiaQuote {
    success: boolean;
    fees: number;
    exchangeRate: number;
    recipientReceives: number;
    error?: string;
}

export interface RiaTransferDetails {
    success: boolean;
    status: 'unknown' | 'available' | 'paid' | 'cancelled';
    senderName: string;
    senderCountry: string;
    amount: number;
    currency: string;
    error?: string;
}

// No provider contract is configured here. Never generate names, amounts or payout references.
const unavailable = 'Vérification automatique Ria indisponible. Soumettez une réclamation pour contrôle par une agence inter habilitée.';
export async function getRiaQuote(amount:number,fromCurrency:string,toCountry:string):Promise<RiaQuote> {
 return {success:false,fees:0,exchangeRate:0,recipientReceives:0,error:unavailable};
}
export async function trackRiaTransfer(transferCode:string):Promise<RiaTransferDetails> {
 return {success:false,status:'unknown',senderName:'',senderCountry:'',amount:0,currency:'',error:unavailable};
}
export async function sendMoney(args:IntlSendArgs):Promise<{success:boolean;transactionId?:string;error?:string}> {
 return {success:false,error:'Envoi automatique Ria indisponible : aucun identifiant fournisseur ne sera simulé.'};
}
