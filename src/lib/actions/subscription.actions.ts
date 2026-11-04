'use server';
import {db} from '@/lib/db';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
import {executeTvSubscription} from '@/lib/ussd/ussd.actions';
export async function getServiceSubscriptionOffers(){
 const user=await getAuthenticatedUser();if(!user||String(user.status).toLowerCase()!=='active')throw new Error('Session active requise.');
 const {rows}=await db.query("SELECT id,provider_code,provider_name,package_name,price_usd,metadata,base_price,base_currency FROM tv_subscription_fees WHERE is_active=TRUE ORDER BY provider_name,package_name");
 return rows.map(row=>{const meta=typeof row.metadata==='string'?JSON.parse(row.metadata):row.metadata||{};return {id:Number(row.id),provider:String(row.provider_code),providerName:row.provider_name,name:row.package_name,price:Number(row.base_price??meta.price??row.price_usd),currency:String(row.base_currency||meta.currency||'USD').toUpperCase()};}).filter(row=>Number.isFinite(row.price)&&row.price>0&&/^[A-Z]{3}$/.test(row.currency));
}
export async function payServiceSubscription(input:{offerId:number;smartcard:string;pin:string;currency:string;maxDebit:number;requestKey:string}){
 try{
  const user=await getAuthenticatedUser();if(!user||String(user.status).toLowerCase()!=='active')throw new Error('Session active requise.');
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.requestKey||''))throw new Error('Identifiant de demande invalide.');
  if(!Number.isSafeInteger(input.offerId)||input.offerId<=0||!Number.isFinite(input.maxDebit)||input.maxDebit<=0||!/^\d{4}$/.test(input.pin))throw new Error('Forfait, montant confirmé et PIN à quatre chiffres requis.');
  return await executeTvSubscription(user,'',input.smartcard,{id:input.offerId},input.currency,input.pin,input.maxDebit,input.requestKey);
 }catch(error:any){return {success:false,error:error.code==='42P01'?'Schéma des abonnements indisponible. Aucun paiement confirmé.':error.message};}
}
/** Retained so old clients fail explicitly rather than submitting a client-selected tariff. */
export async function createSubscription(_args:unknown){return {success:false,error:'Actualisez la page et sélectionnez un forfait du catalogue actuel avec votre PIN.'};}
