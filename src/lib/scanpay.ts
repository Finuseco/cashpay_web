import {db} from '@/lib/db';
import type {PoolClient} from 'pg';
import {createHmac,randomUUID,timingSafeEqual} from 'crypto';
import {countryToCode,currentPrice} from '@/lib/utils';
import {calculateTransactionFee} from '@/lib/actions/wallet.actions';
import {createTransaction} from '@/lib/actions/transaction.actions';
const parse=(v:any,fallback:any=[])=>typeof v==='string'?JSON.parse(v):v??fallback;
function fiat(v:any){const c=String(v||'USD').toUpperCase();if(!['USD','EUR','CDF'].includes(c))throw new Error('Devise de paiement non prise en charge.');return c;}
export function parseScan(value:string):any {
 const text=String(value||'').trim();if(!text||text.length>16000)throw new Error('Code vide ou trop long.');
 if(text.startsWith('{')||text.startsWith('[')){
  let data:any;try{data=JSON.parse(text);}catch{throw new Error('QR JSON invalide.');}
  if(!data||Array.isArray(data)||!['POS_SALE','PRODUCT','PAYMENT_REQUEST','WALLET','BARCODE'].includes(data.type))throw new Error('Type de QR non pris en charge.');return data;
 }
 if(text.startsWith('cashpay:'))return {type:'WALLET',walletId:text.slice(8).split('?')[0]};
 if(/^[A-Z]{2}-?[0-9]{6,32}$/.test(text))return {type:'WALLET',walletId:text};
 if(/^[A-Za-z0-9._-]{3,80}$/.test(text))return {type:'BARCODE',barcode:text};
 throw new Error('Code non reconnu. Utilisez un QR CashPay ou un code-barres produit.');
}
export async function lookupScan(value:string){
 const scan=parseScan(value);
 if(scan.type==='PRODUCT'||scan.type==='BARCODE'){
  const id=scan.type==='PRODUCT'?String(scan.productId||''):null;
  const rows=await db.query(`SELECT p.id,p.name,p.selling_price,p.stock,p.barcode,p.agent_id,p.boutique_id,u.full_name AS seller_name,u.id_wallet AS seller_wallet_id,b.name AS boutique_name
  FROM products p JOIN users u ON u.id=p.agent_id LEFT JOIN boutiques b ON b.id=p.boutique_id AND b.agent_id=p.agent_id
  WHERE LOWER(u.status)='active' AND ${id?'p.id::text=$1':'p.barcode=ANY($1::text[]) AND p.is_public=TRUE'} ORDER BY p.id LIMIT 51`,[id||[scan.barcode,...(/^\d{12}$/.test(scan.barcode)?['0'+scan.barcode]:/^0\d{12}$/.test(scan.barcode)?[scan.barcode.slice(1)]:[])]]);
  if(!rows.rows.length)throw new Error('Aucun article disponible pour ce code.');
  if(rows.rows.length>50)throw new Error('Code trop ambigu. Demandez le QR produit du magasin.');
  return {type:'PRODUCTS',products:rows.rows.map(p=>({id:String(p.id),name:p.name,price:Number(p.selling_price),currency:'USD',stock:Number(p.stock),sellerWalletId:p.seller_wallet_id,sellerName:p.seller_name,boutiqueName:p.boutique_name||p.seller_name}))};
 }
 if(scan.type==='WALLET'){
  const user=(await db.query("SELECT id_wallet,full_name FROM users WHERE id_wallet=$1 AND LOWER(status)='active'",[String(scan.walletId||'').trim()])).rows[0];
  if(!user)throw new Error('Portefeuille introuvable.');return {type:'WALLET',walletId:user.id_wallet,sellerName:user.full_name};
 }
 return {type:scan.type,scan};
}
export async function canonicalSale(c:PoolClient,data:any,lock=false){
 if(data?.type!=='POS_SALE'||!Array.isArray(data.items)||!data.items.length||data.items.length>100)throw new Error('Le QR de caisse doit contenir les articles. Demandez au vendeur de régénérer son QR.');
 const seller=(await c.query("SELECT id,id_wallet,full_name FROM users WHERE id_wallet=$1 AND LOWER(status)='active'",[String(data.sellerWalletId||'').trim()])).rows[0];if(!seller)throw new Error('Vendeur introuvable.');
 const quantities=new Map<string,number>();for(const item of data.items){const id=String(item.id||item.productId||'');const q=Number(item.quantity);if(!/^\d+$/.test(id)||!Number.isSafeInteger(q)||q<=0||q>10000)throw new Error('Article ou quantité invalide.');quantities.set(id,(quantities.get(id)||0)+q);}
 const {rows}=await c.query(`SELECT p.*,b.name AS boutique_name FROM products p LEFT JOIN boutiques b ON b.id=p.boutique_id AND b.agent_id=p.agent_id WHERE p.id::text=ANY($1::text[]) AND p.agent_id=$2 ORDER BY p.id ${lock?'FOR UPDATE OF p':''}`,[Array.from(quantities.keys()),seller.id]);
 if(rows.length!==quantities.size)throw new Error('Un article n’appartient pas au vendeur.');
 let cents=0;const items=rows.map(p=>{
  const quantity=quantities.get(String(p.id))!;const variations=parse(p.variations);
  if(quantity>Number(p.stock)|| (variations.length&&quantity>variations.reduce((s:number,v:any)=>s+Number(v.stock||0),0)))throw new Error(`Stock insuffisant : ${p.name}.`);
  const price=currentPrice({sellingPrice:p.selling_price,promotionalPackages:parse(p.promotional_packages)},quantity);
  const unit=Math.round(price*100);if(!Number.isSafeInteger(unit)||unit<=0)throw new Error('Prix catalogue invalide.');cents+=unit*quantity;
  return {id:String(p.id),name:p.name,quantity,sellingPrice:unit/100,variations};
 });
 if(!Number.isSafeInteger(cents)||cents<=0)throw new Error('Total de vente invalide.');
 return {type:'POS_SALE',sellerId:Number(seller.id),sellerWalletId:seller.id_wallet,sellerName:seller.full_name,boutiqueName:rows[0]?.boutique_name||seller.full_name,amount:cents/100,currency:'USD',items};
}
async function pricePayment(c:PoolClient,user:any,scan:any,paymentCurrency:string){
 let sale:any;
 if(scan.type==='POS_SALE')sale=await canonicalSale(c,scan);
 else if(scan.type==='PAYMENT_REQUEST'){
  const recipient=(await c.query("SELECT id,id_wallet,full_name FROM users WHERE id_wallet=$1 AND LOWER(status)='active'",[String(scan.recipient||'').trim()])).rows[0];
  if(typeof scan.currency!=='string'||!scan.currency.trim())throw new Error('Devise de la demande manquante.');
  const amount=Number(scan.amount);if(!recipient||!Number.isFinite(amount)||!Number.isSafeInteger(Math.round(amount*100))||amount<=0||Math.round(amount*100)!==amount*100&&Math.abs(Math.round(amount*100)-amount*100)>0.00001)throw new Error('Demande de paiement invalide.');
  sale={type:'PAYMENT_REQUEST',sellerId:recipient.id,sellerWalletId:recipient.id_wallet,sellerName:recipient.full_name,amount,currency:fiat(scan.currency),items:[]};
 }else throw new Error('Ce code ne permet pas un paiement.');
 if(Number(user.id)===Number(sale.sellerId))throw new Error('Vous ne pouvez pas vous payer vous-même.');
 let rate=1;if(paymentCurrency!==sale.currency){const fx=(await c.query('SELECT rate FROM exchange_rates WHERE country_code=$1 AND from_currency=$2 AND to_currency=$3',[countryToCode(user.country)||'GBL',sale.currency,paymentCurrency])).rows[0];rate=Number(fx?.rate);if(!Number.isFinite(rate)||rate<=0)throw new Error('Taux de change indisponible.');}
 const debitAmount=sale.amount*rate;const fee=Number(await calculateTransactionFee(debitAmount,paymentCurrency,'TR',user.country,c));if(!Number.isFinite(debitAmount)||!Number.isFinite(debitAmount+fee)||debitAmount+fee>Number.MAX_SAFE_INTEGER/100)throw new Error('Montant hors des limites de précision.');if(!Number.isFinite(fee)||fee<0)throw new Error('Frais indisponibles.');
 return {sale,paymentCurrency,debitAmount,fee,totalDebit:debitAmount+fee,rate};
}
function key(){if(!process.env.JWT_SECRET)throw new Error('Signature des devis non configurée.');return process.env.JWT_SECRET;}
function sign(payload:any){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return body+'.'+createHmac('sha256',key()).update('scanpay:v1:'+body).digest('base64url');}
function read(token:string){if(typeof token!=='string'||token.length>30000)throw new Error('Devis invalide.');const [body,mac,...extra]=token.split('.');const expected=createHmac('sha256',key()).update('scanpay:v1:'+body).digest();const got=Buffer.from(mac||'','base64url');if(extra.length||got.length!==expected.length||!timingSafeEqual(got,expected))throw new Error('Signature du devis invalide.');const payload=JSON.parse(Buffer.from(body,'base64url').toString());if(!Number.isFinite(payload.exp)||typeof payload.id!=='string')throw new Error('Devis invalide.');return payload;}
export async function quoteScan(user:any,scan:any,paymentCurrency='USD'){
 const c=await db.getConnection();try{const priced=await pricePayment(c,user,scan,fiat(paymentCurrency));const input=priced.sale.type==='POS_SALE'?{type:'POS_SALE',sellerWalletId:priced.sale.sellerWalletId,items:priced.sale.items.map((i:any)=>({id:i.id,quantity:i.quantity}))}:{type:'PAYMENT_REQUEST',recipient:priced.sale.sellerWalletId,amount:priced.sale.amount,currency:priced.sale.currency};
 const payload={id:randomUUID(),userId:user.id,input,paymentCurrency:priced.paymentCurrency,amount:priced.sale.amount,fee:priced.fee,totalDebit:priced.totalDebit,exp:Date.now()+300000};return {...priced,quoteToken:sign(payload),expiresAt:new Date(payload.exp).toISOString()};}finally{c.release();}
}
export async function payScan(user:any,token:string){
 const quote=read(token);if(Number(quote.userId)!==Number(user.id))throw new Error('Ce devis appartient à un autre compte.');
 const c=await db.getConnection();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['scanpay:'+quote.id]);
 const previous=(await c.query("SELECT id,reference_code FROM transactions WHERE sender_id=$1 AND metadata->>'scanPaymentId'=$2 AND status='Completed' LIMIT 1",[user.id,quote.id])).rows[0];if(previous){await c.query('COMMIT');return {success:true,reference:previous.reference_code,alreadyProcessed:true};}
 if(quote.exp<Date.now())throw new Error('Devis expiré. Vérifiez l’historique avant de créer un nouveau paiement.');
 const sale=quote.input.type==='POS_SALE'?await canonicalSale(c,quote.input,true):null;
 const priced=await pricePayment(c,user,quote.input,fiat(quote.paymentCurrency));
 if(priced.sale.amount!==quote.amount||Math.abs(priced.fee-quote.fee)>1e-8||Math.abs(priced.totalDebit-quote.totalDebit)>1e-8)throw new Error('Prix, frais ou taux modifiés. Actualisez et confirmez le nouveau devis.');
 const wallets=await c.query('SELECT user_id,balances FROM wallets WHERE user_id=ANY($1::int[]) ORDER BY user_id FOR UPDATE',[[user.id,priced.sale.sellerId]]);if(wallets.rows.length!==2)throw new Error('Wallet payeur ou bénéficiaire introuvable.');const before=wallets.rows.find(row=>Number(row.user_id)===Number(user.id));
 const tx=await createTransaction({user,typeCode:priced.sale.type==='POS_SALE'?'POS_SALE':'PAYMENT',amount:priced.sale.amount,currency:priced.sale.currency,sourceCurrency:priced.paymentCurrency,receiver_id:priced.sale.sellerId,description:`Paiement à ${priced.sale.sellerName}`,metadata:{scanPaymentId:quote.id,items:priced.sale.items.map(({variations,...i}:any)=>i)},connection:c});
 if(!tx.success)throw new Error(tx.error||'Paiement refusé.');
 if(Math.abs(Number(tx.fee)-priced.fee)>1e-8||Math.abs(Number(parse(before.balances,{})[priced.paymentCurrency]||0)-Number(tx.senderNewBalance)-priced.totalDebit)>1e-6)throw new Error('Le débit ne correspond plus au devis. Aucun paiement confirmé.');
 if(sale)for(const item of sale.items){let remaining=item.quantity;for(const variant of item.variations){const taken=Math.min(Number(variant.stock||0),remaining);variant.stock-=taken;remaining-=taken;}await c.query('UPDATE products SET stock=stock-$2,variations=$3::jsonb WHERE id=$1',[item.id,item.quantity,JSON.stringify(item.variations)]);}
 await c.query('COMMIT');return {success:true,reference:tx.reference,transactionId:tx.transactionId,amount:priced.sale.amount,currency:priced.sale.currency,totalDebit:priced.totalDebit,paymentCurrency:priced.paymentCurrency};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
