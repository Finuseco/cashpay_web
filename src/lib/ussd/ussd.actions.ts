'use server';
import { db } from '@/lib/db';
import { formatUser, countryToCode } from '@/lib/utils';
import { createTransaction } from '@/lib/actions/transaction.actions';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import { verifyUserPin } from '@/lib/actions/auth.actions';
import { countries } from '@/lib/countries';
import { createSubscription } from '@/lib/actions/subscription.actions';
import { purchaseCard } from '@/lib/actions/card.actions';
import config from '@/config';
import { getExchangeRatesForCountry } from '@/lib/actions/exchange.actions';
import type { User } from '@/lib/types';
import crypto from 'crypto';
import { sendSms } from '@/services/sms';

const digits=(v:string)=>v.replace(/\D/g,'');
const variants=(v:string)=>{const n=digits(v);return [...new Set([n,`+${n}`,n.replace(/^243/,'0'),n.replace(/^0/,'243')])];};
const json=(v:any)=>{try{return typeof v==='string'?JSON.parse(v||'{}'):(v||{});}catch{return {};}};
export async function getUserForUssd(phone:string){try{const {rows}=await db.query('SELECT * FROM users WHERE phone=ANY($1) LIMIT 1',[variants(phone)]);if(!rows.length)return null;const r=rows[0],u:any=formatUser(r);return {...u,id:r.id,role:r.role,status:r.status,country:r.country,phone:r.phone,id_wallet:r.id_wallet,first_name:r.first_name,full_name:r.full_name,ussd_language:r.ussd_language,pin_hash:r.pin_hash};}catch{return null;}}
export async function saveUssdLanguage(userId:number,lang:'fr'|'en'){try{await db.query('UPDATE users SET ussd_language=$1,updated_at=NOW() WHERE id=$2',[lang,userId]);return lang;}catch{return null;}}
export async function getCountryByPhone(phone:string){const n=digits(phone);return countries.find((c:any)=>n.startsWith(String(c.dial_code||'').replace('+','')))||countries.find((c:any)=>c.code==='CD')!;}
export async function getUssdRecipientInfo(identifier:string){const raw=identifier.trim(),n=digits(identifier);try{const refs=[raw,n,`+${n}`,n.replace(/^0/,'243')];const {rows}=await db.query('SELECT id,role,status,first_name,full_name,id_wallet,phone FROM users WHERE id_wallet=$1 OR phone=ANY($2) LIMIT 1',[raw,refs]);if(!rows.length)return {success:false,error:'Destinataire introuvable.'};const r=rows[0];return {success:true,firstName:r.first_name||r.full_name||'Client',userId:r.id,walletId:r.id_wallet,phone:r.phone,role:r.role,status:r.status};}catch{return {success:false,error:'Service indisponible.'};}}
export async function getUssdBalance(userId:number,currency:string){try{const {rows}=await db.query('SELECT balances FROM wallets WHERE user_id=$1',[userId]);return Number(json(rows[0]?.balances)[currency]||0);}catch{return 0;}}
export async function getCommissionBalance(userId:number,currency:string){try{const {rows}=await db.query('SELECT commission_balance,balances FROM wallets WHERE user_id=$1',[userId]);const c=json(rows[0]?.commission_balance);return Number(c[currency]||0);}catch{return 0;}}
export async function getUssdFee(amount:number,currency:string,typeCode:string,countryName:string){return calculateTransactionFee(amount,currency,typeCode,countryName);}

async function getAgentWithdrawalCommissionRate(){
  const raw=String(process.env.AGENT_WITHDRAW_COMMISSION_RATE||'').trim();
  const rate=Number(raw);
  if(!Number.isFinite(rate)||rate<0||rate>100) throw new Error('Commission de retrait agent non configurée.');
  return rate/100;
}

async function creditAgentCommission(agentId:number,currency:string,amount:number){
  const rate=await getAgentWithdrawalCommissionRate();
  const commission=Number((amount*rate).toFixed(2));
  if(commission<=0)return {commission:0,rate};
  const {rows}=await db.query('SELECT commission_balance FROM wallets WHERE user_id=$1::integer FOR UPDATE',[agentId]);
  if(!rows.length)throw new Error('Portefeuille agent introuvable.');
  const balances=json(rows[0].commission_balance);
  const ccy=String(currency||'').toUpperCase();
  balances[ccy]=Number((Number(balances[ccy]||0)+commission).toFixed(2));
  await db.query('UPDATE wallets SET commission_balance=$1::jsonb,last_updated=NOW() WHERE user_id=$2::integer',[JSON.stringify(balances),agentId]);
  return {commission,rate};
}

export async function executeClientAgentWithdrawal(client:User,agentRef:string,amount:number,currency:string,pin:string){
  const p=await verifyUserPin(client.id,pin);
  if(!p.success)return {success:false,error:'Code PIN incorrect.'};
  const agent=await getUssdRecipientInfo(agentRef);
  if(!agent.success)return agent;
  const {rows}=await db.query('SELECT 1 FROM boutiques WHERE agent_id=$1 LIMIT 1',[agent.userId]);
  if(!rows.length)return {success:false,error:'Cet utilisateur n’est pas un agent CashPay.'};
  const tx=await createTransaction({user:client,typeCode:'TR',amount,currency,description:`Retrait Cash auprès de ${agent.firstName}`,metadata:{channel:'USSD',operation:'CLIENT_AGENT_WITHDRAWAL',agent_id:agent.userId,agent_wallet_id:agent.walletId}});
  if(!tx.success)return tx;
  const share=await creditAgentCommission(Number(agent.userId),currency,amount);
  return {...tx,commission:share.commission,commissionRate:share.rate,agent:agent};
}

export async function initiateAgentCashWithdrawal(agent:User,clientRef:string,amount:number,currency:string){
  const client=await getUssdRecipientInfo(clientRef);
  if(!client.success)return client;
  const {rows:agentRows}=await db.query('SELECT 1 FROM boutiques WHERE agent_id=$1 LIMIT 1',[agent.id]);
  if(!agentRows.length)return {success:false,error:'Agent non enregistré dans une boutique.'};
  const fee=Number(await getUssdFee(amount,currency,'TR',String((agent as any).country||'')));
  const otp=String(Math.floor(100000+Math.random()*900000));
  const hash=crypto.createHash('sha256').update(otp).digest('hex');
  const reference=`AGW-${Date.now()}-${agent.id}`;
  await db.query(`CREATE TABLE IF NOT EXISTS agent_withdrawal_requests(
    id BIGSERIAL PRIMARY KEY, reference_code TEXT UNIQUE NOT NULL, agent_id INTEGER NOT NULL, client_id INTEGER NOT NULL,
    amount NUMERIC NOT NULL, fee NUMERIC NOT NULL, currency TEXT NOT NULL, otp_hash TEXT NOT NULL,
    otp_expires_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), authorized_at TIMESTAMPTZ
  )`);
  await db.query(`INSERT INTO agent_withdrawal_requests(reference_code,agent_id,client_id,amount,fee,currency,otp_hash,otp_expires_at,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,NOW()+INTERVAL '10 minutes','pending')`,[reference,agent.id,client.userId,amount,fee,currency,hash]);
  return {success:true,reference,otp,fee,client};
}

export async function authorizeAgentCashWithdrawal(client:User,otp:string){
  const hash=crypto.createHash('sha256').update(String(otp||'')).digest('hex');
  const {rows}=await db.query(`SELECT * FROM agent_withdrawal_requests WHERE client_id=$1 AND otp_hash=$2 AND status='pending' AND otp_expires_at>NOW() ORDER BY id DESC LIMIT 1`,[client.id,hash]);
  if(!rows.length)return {success:false,error:'OTP invalide ou expiré.'};
  const r=rows[0];
  const agentInfo=await getUssdRecipientInfo(String(r.agent_id));
  if(!agentInfo.success)return {success:false,error:'Agent introuvable.'};
  const tx=await createTransaction({user:client,typeCode:'TR',amount:Number(r.amount),currency:r.currency,description:`Retrait Cash auprès de ${agentInfo.firstName}`,metadata:{channel:'USSD',operation:'AGENT_CASH_WITHDRAWAL',agent_id:r.agent_id,agent_wallet_id:agentInfo.walletId,request_reference:r.reference_code}});
  if(!tx.success)return tx;
  const share=await creditAgentCommission(Number(r.agent_id),r.currency,Number(r.amount));
  await db.query(`UPDATE agent_withdrawal_requests SET status='authorized',authorized_at=NOW() WHERE id=$1`,[r.id]);
  const agentPhone=String(agentInfo.phone||'').trim();
  if(agentPhone)await sendSms(agentPhone,`CashPay\nReçu : ${Number(r.amount).toFixed(2)} ${r.currency} | Commission : ${share.commission.toFixed(2)} ${r.currency}\nRéf : ${tx.reference||r.reference_code}`).catch(()=>null);
  return {...tx,commission:share.commission,commissionRate:share.rate,reference:tx.reference||r.reference_code};
}
export async function getUssdExchangeRates(user:User){return getExchangeRatesForCountry(countryToCode(user.country));}
export async function executeUssdTransfer(sender:User,recipientRef:string,amount:number,currency:string,pin:string){const p=await verifyUserPin(sender.id,pin);if(!p.success)return {success:false,error:'Code PIN incorrect.'};const r=await getUssdRecipientInfo(recipientRef);if(!r.success)return r;return createTransaction({user:sender,typeCode:'TR',amount,currency,description:`Transfert CashPay vers ${r.firstName}`,receiver_id:r.userId!,receiver_wallet_id:r.walletId!,metadata:{channel:'USSD'}});}
export async function executeAgentDeposit(agent:User,clientRef:string,amount:number,currency:string,pin:string){const p=await verifyUserPin(agent.id,pin);if(!p.success)return {success:false,error:'Code PIN incorrect.'};const c=await getUssdRecipientInfo(clientRef);if(!c.success)return c;return createTransaction({user:agent,typeCode:'DP_AGENT',amount,currency,description:`Dépôt CashPay vers ${c.firstName}`,receiver_id:c.userId!,receiver_wallet_id:c.walletId!,metadata:{channel:'USSD'}});}
export async function executeAgentWithdraw(agent:User,clientRef:string,amount:number,currency:string,pin:string){const p=await verifyUserPin(agent.id,pin);if(!p.success)return {success:false,error:'Code PIN incorrect.'};const c=await getUssdRecipientInfo(clientRef);if(!c.success)return c;const {rows}=await db.query('SELECT * FROM users WHERE id=$1 LIMIT 1',[c.userId]);if(!rows.length)return {success:false,error:'Client introuvable.'};const client:any=formatUser(rows[0]);const tx=await createTransaction({user:client,typeCode:'TR',amount,currency,description:`Retrait CashPay auprès de ${agent.full_name||agent.first_name||'Agent'}`,metadata:{channel:'USSD',operation:'AGENT_WITHDRAWAL',agent_id:agent.id,agent_wallet_id:agent.id_wallet}});if(!tx.success)return tx;const share=await creditAgentCommission(agent.id,currency,amount);return {...tx,commission:share.commission,commissionRate:share.rate};}
export async function executeCommissionClaim(user:User,amount:number,currency:string,pin:string){const p=await verifyUserPin(user.id,pin);if(!p.success)return {success:false,error:'Code PIN incorrect.'};return createTransaction({user,typeCode:'MLM_COMM_CLAIM',amount,currency,sourceCurrency:'COMMISSION',description:`Bascule des commissions vers ${currency}`,metadata:{channel:'USSD',currency}});}
export async function executeUssdExchange(user:User,amount:number,currency:string,toCurrency:string,rate:number,pin:string){const p=await verifyUserPin(user.id,pin);if(!p.success)return {success:false,error:'Code PIN incorrect.'};return createTransaction({user,typeCode:'EXCHANGE',amount,currency,description:`Échange ${currency} vers ${toCurrency}`,metadata:{channel:'USSD',fromCurrency:currency,toCurrency,toAmount:amount*rate,rate}});}
export async function fetchUssdHistory(userId:number,currency:string,page=0){try{const limit=5;const {rows}=await db.query('SELECT type_code,amount,currency,created_at FROM transactions WHERE (sender_id=$1 OR receiver_id=$1) AND currency=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4',[userId,currency,limit,page*limit]);return {items:rows.map(r=>({type:r.type_code,amount:Number(r.amount),currency:r.currency,date:r.created_at})),hasNext:rows.length===limit};}catch{return {items:[],hasNext:false};}}
export async function getCommissionStats(userId:number,currency:string){try{const available=await getCommissionBalance(userId,currency);const {rows}=await db.query("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE receiver_id=$1 AND type_code='MLM_COMM' AND currency=$2 AND created_at>=CURRENT_DATE",[userId,currency]);return {available,daily:Number(rows[0]?.total||0)};}catch{return {available:0,daily:0};}}
export async function getTvPackages(providerCode:string){
  try{
    const aliases:any={
      CANALPLUS:['CANALPLUS','CANAL_PLUS','CANAL+','CANALPLUS RDC','CANAL PLUS'],
      STARTIMES:['STARTIMES','STAR_TIMES','STAR TIMES'],
      DSTV:['DSTV','DStv','DSTV RDC']
    };
    const key=String(providerCode||'').toUpperCase();
    const list=aliases[key]||[providerCode];
    const {rows}=await db.query(
      `SELECT id,provider_code,provider_name,package_code,package_name,price_usd,duration_days,
              decoder_required,card_number_required,is_active,metadata,base_price,base_currency
       FROM tv_subscription_fees
       WHERE is_active=true
         AND regexp_replace(UPPER(TRIM(provider_code)), '[^A-Z0-9]', '', 'g')
             = ANY($1::text[])
       ORDER BY COALESCE(base_price,price_usd) ASC, package_name ASC`,
      [list.map((x:any)=>String(x).toUpperCase().replace(/[^A-Z0-9]/g,''))]
    );
    return rows;
  }catch{return [];}
}

export async function executeTvSubscription(user:User,operator:string,smartcard:string,packageData:any,currency:string,pin:string){
  const p=await verifyUserPin(user.id,pin);
  if(!p.success)return {success:false,error:'Code PIN incorrect.'};

  try{
    const packageId=Number(packageData?.id);
    if(!Number.isInteger(packageId)||packageId<=0)return {success:false,error:'Abonnement TV invalide.'};

    const {rows}=await db.query(
      `SELECT id,provider_code,provider_name,package_code,package_name,
              price_usd,duration_days,decoder_required,card_number_required,
              is_active,base_price,base_currency
       FROM tv_subscription_fees
       WHERE id=$1 AND is_active=true
       LIMIT 1`,
      [packageId]
    );
    if(!rows.length)return {success:false,error:'Abonnement TV introuvable.'};

    const pkg=rows[0];
    const amount=Number(pkg.base_price??pkg.price_usd);
    if(!Number.isFinite(amount)||amount<=0)return {success:false,error:'Prix de l’abonnement TV invalide.'};

    if(pkg.decoder_required||pkg.card_number_required){
      if(!String(smartcard||'').trim())return {success:false,error:'Numéro Smartcard / décodeur requis.'};
    }

    return createSubscription({
      user,
      serviceName:`Abonnement ${pkg.provider_name||operator} - ${pkg.package_name}`,
      amount,
      operatorName:pkg.provider_name||operator,
      smartcardNumber:String(smartcard||'')
    });
  }catch(e:any){
    return {success:false,error:e?.message||'Service TV indisponible.'};
  }
}

export async function getUssdCardPurchaseOptions(currency:string,cardType:'virtuelle'|'physique',countryName?:string){
  const ccy=String(currency||'').toUpperCase();
  const suffix=cardType==='virtuelle'?'V':'P';
  const feeCode=`BUY_CARDS_${ccy}_${suffix}_FEE`;
  const fee=Number(await calculateTransactionFee(1,ccy,feeCode,countryName||null));
  const cfg:any=config.fyatu as any;
  const keys=(brand:string)=>cardType==='virtuelle'
    ? (brand==='visa'?['productTokenVisaVirtual','productTokenVirtualVisa']:['productTokenMastercardVirtual','productTokenVirtualMastercard'])
    : (brand==='visa'?['productTokenVisaPhysical','productTokenPhysicalVisa']:['productTokenMastercardPhysical','productTokenPhysicalMastercard']);
  const fallback=cardType==='virtuelle'?cfg.productTokenVirtual:cfg.productTokenPhysical;
  return ['visa','mastercard'].map(brand=>({brand,cardType,currency:ccy,fee,feeCode,configured:fee>0&&!!(keys(brand).map((k:string)=>cfg[k]).find(Boolean)||fallback)}));
}

export async function executeUssdCardPurchase(user:User,cardType:'virtuelle'|'physique',brand:'visa'|'mastercard',currency:string,pin:string){
  const p=await verifyUserPin(user.id,pin);
  if(!p.success)return {success:false,error:'Code PIN incorrect.'};
  try{
    return await purchaseCard({user,card_type:cardType,brand,currency,pin});
  }catch(e:any){
    return {success:false,error:"Impossible d'émettre la carte."};
  }
}

export async function getUssdCardsForUser(userId:number){
  try{
    const {rows}=await db.query(
      `SELECT id, card_provider_id, fyatu_user_token, fyatu_card_token,
              card_type, brand, currency, last4, exp_month, exp_year, status
       FROM cards
       WHERE user_id=$1
         AND LOWER(COALESCE(status,'')) <> 'cancelled'
       ORDER BY currency ASC,
                CASE WHEN card_type='virtuelle' THEN 1 WHEN card_type='physique' THEN 2 ELSE 3 END,
                id ASC`,
      [userId]
    );
    return rows;
  }catch{return [];}
}

export async function getCardTransactionsAction(cardId:string,userId:number,page=1,limit=5){
  try{
    const offset=Math.max(0,(Number(page)-1)*Number(limit));
    const {rows}=await db.query(
      `SELECT id,type_code,amount,currency,description,created_at,metadata
       FROM transactions
       WHERE (
         metadata->>'card_id'=$2
         OR metadata->>'from_card_id'=$2
         OR metadata->>'to_card_id'=$2
       )
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId,String(cardId),Number(limit),offset]
    );
    return {success:true,transactions:rows.map((r:any)=>({id:r.id,type:r.type_code,amount:Number(r.amount),currency:r.currency,description:r.description,date:r.created_at,metadata:json(r.metadata)}))};
  }catch(e:any){return {success:false,error:e?.message||'Impossible de récupérer les transactions.'};}
}

export async function executeBecomeClient(user:User){
  try{
    const {rows}=await db.query("SELECT role FROM users WHERE id=$1",[user.id]);
    const role=String(rows[0]?.role||'').toLowerCase();
    if(!['agent','superagent'].includes(role))return {success:false,error:'Rôle agent introuvable.'};
    await db.query("UPDATE users SET role='client',updated_at=NOW() WHERE id=$1",[user.id]);
    return {success:true};
  }catch{return {success:false,error:'Impossible de changer de rôle.'};}
}

export async function executeBecomeAgent(user:User,currency:string,pin:string){
  const verified=await verifyUserPin(user.id,pin);
  if(!verified.success)return {success:false,error:'Code PIN incorrect.'};
  const connection=await db.getConnection();
  try{
    await connection.query('BEGIN');
    const {rows}=await connection.query("SELECT role FROM users WHERE id=$1 FOR UPDATE",[user.id]);
    const role=String(rows[0]?.role||'').toLowerCase();
    if(['agent','superagent','admin'].includes(role))throw new Error('Vous êtes déjà agent.');
    const ccy=String(currency).toUpperCase();
    const candidates=[
      `BECOME_AGENT_${ccy}_PROMO_FEE`,
      `BECOME_AGENT_${ccy}_FEE`,
      `AGENT_ACTIVATION_${ccy}_PROMO_FEE`,
      `AGENT_ACTIVATION_${ccy}_FEE`,
      `AGENT_ROLE_${ccy}_PROMO_FEE`,
      `AGENT_ROLE_${ccy}_FEE`,
      `AGENT_${ccy}_PROMO_FEE`,
      `AGENT_${ccy}_FEE`
    ];
    let fee=0, feeCode='';
    for(const code of candidates){
      try{
        const value=Number(await calculateTransactionFee(1,currency,code,(user as any).country||null,connection));
        if(Number.isFinite(value)&&value>0){fee=value;feeCode=code;break;}
      }catch{}
    }
    if(!feeCode)throw new Error('Forfait agent introuvable pour cette devise.');
    const tx=await createTransaction({
      user,typeCode:feeCode,amount:fee,currency,
      description:'Activation du rôle agent',
      metadata:{channel:'USSD',role_change:'client_to_agent',fee_code:feeCode},
      connection
    });
    if(!tx.success)throw new Error(tx.error||'Le débit du forfait agent a échoué.');
    await connection.query("UPDATE users SET role='agent',updated_at=NOW() WHERE id=$1",[user.id]);
    await connection.query('COMMIT');
    return {success:true,fee,feeCode};
  }catch(e:any){
    try{await connection.query('ROLLBACK');}catch{}
    return {success:false,error:e?.message||'Impossible d’activer le rôle agent.'};
  }finally{connection.release();}
}

export async function createInternationalClaim(user:User,provider:string,tracking:string,amount:number,currency:string,senderCountry:string,receiveCurrency:string,pin:string){const p=await verifyUserPin(user.id,pin);if(!p.success)return {success:false,error:'Code PIN incorrect.'};try{const {rows}=await db.query("INSERT INTO international_transfer_claims(user_id,provider,tracking_number,expected_amount,expected_currency,sender_country,receive_in_currency,status) VALUES($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING id",[user.id,provider,tracking,amount,currency,senderCountry,receiveCurrency]);return {success:true,id:rows[0]?.id};}catch{return {success:false,error:'Service indisponible.'};}}
export async function getInternationalClaims(userId:number){try{const {rows}=await db.query('SELECT provider,tracking_number,expected_amount,expected_currency,status,created_at FROM international_transfer_claims WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5',[userId]);return rows;}catch{return [];}}
export async function createMaxiCashGatewayLink(user:User,amount:number,currency:string,reference:string,lang:'fr'|'en',method:'card'|'mobile_money'){try{const base=process.env.MAXICASH_GATEWAY_URL||'https://api.maxicashapp.com/PayEntry';const merchantId=process.env.MAXICASH_MERCHANT_ID,merchantPassword=process.env.MAXICASH_MERCHANT_PASSWORD;if(!merchantId||!merchantPassword)return {success:false,error:'Service de paiement indisponible.'};const origin=process.env.CASHPAY_PUBLIC_URL||'https://app.cashpay-all.com';const data={PayType:'MaxiCash',Amount:String(Math.round(amount*100)),Currency:currency==='USD'?'maxiDollar':currency,Telephone:user.phone||'',Email:(user as any).email||'',MerchantID:merchantId,MerchantPassword:merchantPassword,Language:lang,Reference:reference,Accepturl:`${origin}/payment/maxicash/success`,Cancelurl:`${origin}/payment/maxicash/cancel`,Declineurl:`${origin}/payment/maxicash/decline`,NotifyURL:`${origin}/api/maxicash/webhook`};const link=`${base}?data=${encodeURIComponent(JSON.stringify(data))}`;return {success:true,link,reference,method};}catch{return {success:false,error:'Service de paiement indisponible.'};}}
export async function executeMaxiCashPayNow(user:User,amount:number,currency:string,reference:string,lang:'fr'|'en',paymentType='MaxiCash'){try{const url=process.env.MAXICASH_API_URL||'https://api.maxicashapp.com/Merchant/api.asmx/PayNowAsynch',merchantId=process.env.MAXICASH_MERCHANT_ID,merchantPassword=process.env.MAXICASH_MERCHANT_PASSWORD;if(!merchantId||!merchantPassword)return {success:false,error:'Service de paiement indisponible.'};const payload={PayType:paymentType,Amount:Math.round(amount*100),Currency:currency==='USD'?'maxiDollar':currency,Telephone:user.phone||'',MerchantID:merchantId,MerchantPassword:merchantPassword,Language:lang,Reference:reference};const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strData:JSON.stringify(payload)})});if(!r.ok)return {success:false,error:'Service de paiement indisponible.'};const raw:any=await r.json();const d=typeof raw?.d==='string'?JSON.parse(raw.d):raw?.d||raw;return String(d?.[1]||'').toLowerCase()==='success'?{success:true,paymentId:d?.[3],paymentType:d?.[6],reference}:{success:false,error:d?.[2]||'Paiement refusé.'};}catch{return {success:false,error:'Service de paiement indisponible.'};}}
export async function executeMobileMoneyTransfer(user:User,amount:number,currency:string,country:string,operator:string,phone:string,pin:string,reference:string,feeTypeCode?:string){const p=await verifyUserPin(user.id,pin);if(!p.success)return {success:false,error:'Code PIN incorrect.'};try{const url=process.env.CASHPAY_MOBILE_MONEY_URL;if(!url)return {success:false,error:'Service Mobile Money indisponible.'};const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.CASHPAY_MOBILE_MONEY_TOKEN||''}`},body:JSON.stringify({reference,userId:user.id,amount,currency,country,operator,phone})});const d:any=await r.json().catch(()=>({}));if(!(r.ok&&d.success!==false))return {success:false,error:d.error||'Paiement Mobile Money refusé.'};if(feeTypeCode){const tx=await createTransaction({user,typeCode:feeTypeCode,amount,currency,description:`Transfert Mobile Money ${operator}`,metadata:{channel:'USSD',operation:'PAYOUT',reference,country,operator,phone},});if(!tx.success)return {success:false,error:tx.error||'Le débit Mobile Money a échoué.'};}return {success:true,reference:d.reference||reference};}catch{return {success:false,error:'Service Mobile Money indisponible.'};}}

export async function executeAgentMobileMoney(agent:User,clientRef:string,amount:number,currency:string,operator:string,phone:string,pin:string,direction:'collect'|'payout',reference:string,feeTypeCode?:string){const p=await verifyUserPin(agent.id,pin);if(!p.success)return {success:false,error:'Code PIN incorrect.'};try{const url=process.env.CASHPAY_MOBILE_MONEY_AGENT_URL||process.env.CASHPAY_MOBILE_MONEY_URL;if(!url)return {success:false,error:'Service Mobile Money indisponible.'};const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.CASHPAY_MOBILE_MONEY_TOKEN||''}`},body:JSON.stringify({reference,agentId:agent.id,clientRef,amount,currency,operator,phone,direction})});const d:any=await r.json().catch(()=>({}));if(!(r.ok&&d.success!==false))return {success:false,error:d.error||'Opération Mobile Money refusée.'};if(direction==='payout'&&feeTypeCode){const tx=await createTransaction({user:agent,typeCode:feeTypeCode,amount,currency,description:`Payout Mobile Money ${operator}`,metadata:{channel:'USSD',operation:'AGENT_PAYOUT',reference,clientRef,operator,phone}});if(!tx.success)return {success:false,error:tx.error||'Le débit du payout Mobile Money a échoué.'};}return {success:true,reference:d.reference||reference};}catch{return {success:false,error:'Service Mobile Money indisponible.'};}}
