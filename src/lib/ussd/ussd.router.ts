import { getCardsForUser } from '../actions/card.actions';
import { confirmWithdrawal } from '../actions/agent.actions';
import { getLoanForUser, getLoanHistory, repayLoan, repayLoanInstallment, processLoanRepayments, getLoanOffer, createLoanApplication, getAgentLoanRepaymentTarget, repayLoanByAgent } from '../actions/loan.actions';
import { db } from '@/lib/db';
import { getUserForUssd,saveUssdLanguage,getCountryByPhone,getUssdRecipientInfo,getUssdBalance,getCommissionBalance,getUssdFee,getUssdExchangeRates,executeUssdTransfer,executeAgentDeposit,executeAgentWithdraw,executeCommissionClaim,executeUssdExchange,executeMobileMoneyTransfer,executeAgentMobileMoney,createMaxiCashGatewayLink,executeMaxiCashPayNow,fetchUssdHistory,getCommissionStats,getTvPackages,executeTvSubscription,createInternationalClaim,getInternationalClaims,getUssdCardPurchaseOptions,executeUssdCardPurchase,executeBecomeAgent,executeBecomeClient,getCardTransactionsAction,executeClientAgentWithdrawal } from './ussd.actions';
import type { User } from '@/lib/types';
import { verifyUserPin, sendAndStoreOtp } from '@/lib/actions/auth.actions';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { sendWhatsAppTextMessage } from '@/services/whatsapp';
import { createNotification } from '@/lib/actions/notification.actions';
import {
  getClientTerminalInfo,
  runDiagnostics,
  getDiagnosticResults,
  rebootUserTerminal
} from '@/lib/actions/starlink.actions';
import {
  getCardById,
  revealCardDetails,
  toggleCardStatus,
  terminateCard,
  setCardPin,
  updateSpendingSource,
  linkCpkToCard,
  transferBetweenCards
} from '@/lib/actions/card.actions';

type Lang='fr'|'en';
type Session={session_id:string;phone_number:string;menu_state:string;authenticated:boolean;data:any};
const T={fr:{lang:'Choisissez la langue\n1. Français\n2. English',currency:'Choisissez la devise',register:'Votre numéro n’est pas enregistré.\n1. Recevoir le lien d’inscription\n0. Quitter',client:'1. Solde\n2. Transfert\n3. Dépôt\n4. Retrait\n5. Recevoir\n6. Échange\n7. Services\n8. Historique\n9. Profil\n0. Quitter',agent:'1. Dépôt client\n2. Retrait client\n3. Commissions\n4. Mon solde\n5. Historique\n6. Services\n7. Profil\n8. Paramètres\n0. Quitter',id:'Entrez le numéro de téléphone ou l’ID Wallet :',amount:'Entrez le montant :',pin:'Entrez votre code PIN :',confirm:'1. Confirmer\n0. Annuler',back:'0. Retour',next:'9. Suivant',invalid:'Choix invalide.',error:'Opération impossible.',unauthorized:'Vous n’êtes pas autorisé à utiliser ce service.\nVeuillez contacter le service client CashPay.',services:'Services\n1. Cartes\n2. Abonnement TV\n3. Airtime\n4. Paramètres\n5. Loan Me\n6. Starlink\n0. Retour',receive:'Recevoir un transfert\n1. Western Union\n2. MoneyGram\n3. Ria\n4. Mes demandes\n0. Retour',deposit:'Dépôt\n1. Carte\n2. Mobile Money\n0. Retour',withdraw:'Retrait\n1. Retrait Agent Cash\n2. Retrait ATM\n3. Autoriser retrait Agent (OTP)\n0. Retour',success:'Opération réussie.',failed:'Opération échouée.',invalidAmount:'Montant invalide.',recipient:'Destinataire introuvable.',clientNotFound:'Client introuvable.',track:'Numéro de suivi :',senderCountry:'Pays d’envoi :',receiveCurrency:'Devise de réception :',tv:'Abonnement TV\nChoisissez l’opérateur :\n1. Canal+\n2. StarTimes\n3. DSTV\n0. Retour'},en:{lang:'Choose language\n1. Français\n2. English',currency:'Choose currency',register:'Your number is not registered.\n1. Receive registration link\n0. Exit',client:'1. Balance\n2. Transfer\n3. Deposit\n4. Withdraw\n5. Receive\n6. Exchange\n7. Services\n8. History\n9. Profile\n0. Exit',agent:'1. Client deposit\n2. Client withdrawal\n3. Commissions\n4. My balance\n5. History\n6. Services\n7. Profile\n8. Settings\n0. Exit',id:'Enter phone number or Wallet ID:',amount:'Enter amount:',pin:'Enter PIN:',confirm:'1. Confirm\n0. Cancel',back:'0. Back',next:'9. Next',invalid:'Invalid choice.',error:'Operation unavailable.',unauthorized:'You are not authorized to use this service.\nPlease contact CashPay Customer Service.',services:'Services\n1. Cards\n2. TV Subscription\n3. Airtime\n4. Settings\n5. Loan Me\n0. Back',receive:'Receive a transfer\n1. Western Union\n2. MoneyGram\n3. Ria\n4. My claims\n0. Back',deposit:'Deposit\n1. Card\n2. Mobile Money\n0. Back',withdraw:'Withdraw\n1. Cash Agent Withdrawal\n2. ATM Withdrawal\n3. Authorize Agent Withdrawal (OTP)\n0. Back',success:'Operation successful.',failed:'Operation failed.',invalidAmount:'Invalid amount.',recipient:'Recipient not found.',clientNotFound:'Client not found.',track:'Tracking number:',senderCountry:'Sender country:',receiveCurrency:'Receive currency:',tv:'TV Subscription\nChoose operator:\n1. Canal+\n2. StarTimes\n3. DSTV\n0. Back'}};
const clean=(v:string)=>v.replace(/\D/g,'');
type AlertKind='security'|'transaction'|'registration'|'balance'|'card';
async function ussdAlert(u:any,subject:string,message:string,kind:AlertKind='security',data:any={}){
  try{
    const channels=Array.isArray(u?.notifications_channel)&&u.notifications_channel.length?u.notifications_channel:['sms','whatsapp','email'];
    const tasks:Promise<any>[]=[];
    if(u?.phone&&channels.includes('sms'))tasks.push(sendSms(String(u.phone),message));
    if(u?.phone&&channels.includes('whatsapp'))tasks.push(sendWhatsAppTextMessage(String(u.phone),message));
    if(u?.email&&channels.includes('email'))tasks.push(sendEmail(String(u.email),subject,'alert',{title:subject,greeting:`Bonjour ${u.first_name||u.full_name||'Client'},`,message:message.replace(/\n/g,'<br/>'),reference:data.reference||'USSD',signature:"L'équipe CashPay"}));
    if(u?.id)tasks.push(createNotification(Number(u.id),subject,message,kind==='transaction'?'transaction':kind==='card'?'card':'new_message',data));
    const results=await Promise.allSettled(tasks);
    const failed=results.filter((r:any)=>r.status==='rejected'||(r.status==='fulfilled'&&r.value?.success===false));
    if(failed.length)console.warn(`[USSD Alert] ${failed.length} canal(aux) en échec pour ${subject}`);
    return {success:failed.length===0,results};
  }catch(error){console.error('[USSD Alert] Error:',error);return {success:false};}
}
async function ussdExplicitChannelAlert(u:any,channel:'sms'|'whatsapp'|'email',subject:string,message:string,data:any={}){
  try{
    let result:any;
    if(channel==='sms'&&u?.phone)result=await sendSms(String(u.phone),message);
    else if(channel==='whatsapp'&&u?.phone)result=await sendWhatsAppTextMessage(String(u.phone),message);
    else if(channel==='email'&&u?.email)result=await sendEmail(String(u.email),subject,'alert',{title:subject,greeting:`Bonjour ${u.first_name||u.full_name||'Client'},`,message:message.replace(/\n/g,'<br/>'),reference:data.reference||'USSD',signature:"L'équipe CashPay"});
    else return {success:false,message:'Canal indisponible.'};
    return result;
  }catch(error:any){console.error(`[USSD Alert] ${channel}:`,error);return {success:false,message:error?.message||'Erreur d’envoi.'};}
}

const langOf=(v:any):Lang=>v==='en'?'en':'fr';
const isAgent=(u:User)=>['agent','superagent','admin'].includes(String((u as any).role||'').toLowerCase());
const blocked=(s:any)=>['disabled','suspended','blocked','inactive','banned'].includes(String(s||'').toLowerCase());
const tz=(c:any)=>({CD:'Africa/Kinshasa',CG:'Africa/Brazzaville',CM:'Africa/Douala',CI:'Africa/Abidjan',BJ:'Africa/Porto-Novo',AO:'Africa/Luanda',RW:'Africa/Kigali'} as any)[c?.code]||'Africa/Kinshasa';
const greeting=(l:Lang,n:string,c:any)=>{const h=Number(new Intl.DateTimeFormat('en-US',{hour:'2-digit',hour12:false,timeZone:tz(c)}).format(new Date()));const fr=h<5||h>=22?'Bonne nuit':h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir';const en=h<5||h>=22?'Good night':h<12?'Good morning':h<18?'Good afternoon':'Good evening';return `${l==='fr'?fr:en}, ${n}.`;};
const done=(ok:boolean,l:Lang,ref?:any,error?:string)=>ok?`END ${T[l].success}\n${l==='fr'?'Merci d’avoir utilisé CashPay.':'Thank you for using CashPay.'}`:`END ${error||T[l].failed}`;
const currencies=(c:any)=>[...new Set([c?.currency_code||c?.currency||'CDF','USD','EUR'])].slice(0,3);
const main=(u:any,s:Session,d:any,l:Lang,c:any)=>`CON ${greeting(l,u.first_name||u.full_name||'Client',c)}\n${isAgent(u)?T[l].agent:T[l].client}`;
async function getSession(id:string,phone:string):Promise<Session>{const {rows}=await db.query('SELECT * FROM ussd_sessions WHERE session_id=$1',[id]);if(rows.length)return {...rows[0],data:rows[0].data||{}};const s={session_id:id,phone_number:clean(phone),menu_state:'START',authenticated:false,data:{}};await db.query('INSERT INTO ussd_sessions(session_id,phone_number,menu_state,authenticated,data) VALUES($1,$2,$3,$4,$5)',[id,s.phone_number,'START',false,'{}']);return s;}
async function save(s:Session,data:any,state:string){s.data=data;s.menu_state=state;await db.query('UPDATE ussd_sessions SET menu_state=$2,data=$3,updated_at=NOW() WHERE session_id=$1',[s.session_id,state,JSON.stringify(data)]);}
const current=(text:string)=>{const p=text.trim()?text.trim().split('*'):[];return p[p.length-1]||'';};
const profile=(u:any,l:Lang,a:boolean)=>l==='fr'?`${a?'Profil Agent':'Profil'}\nNom: ${u.first_name||u.full_name||''}\nTéléphone: ${u.phone||''}\nE-mail: ${u.email||''}\nID Wallet: ${u.id_wallet||''}`:`${a?'Agent Profile':'Profile'}\nName: ${u.first_name||u.full_name||''}\nPhone: ${u.phone||''}\nEmail: ${u.email||''}\nWallet ID: ${u.id_wallet||''}`;
const err=(e:string,l:Lang)=>({ 'Code PIN incorrect.':l==='fr'?'Code PIN incorrect.':'Incorrect PIN.','Destinataire introuvable.':l==='fr'?'Destinataire introuvable.':'Recipient not found.','Service indisponible.':l==='fr'?'Service indisponible.':'Service unavailable.','Service de paiement indisponible.':l==='fr'?'Service de paiement indisponible.':'Payment service unavailable.','Service Mobile Money indisponible.':l==='fr'?'Service Mobile Money indisponible.':'Mobile Money service unavailable.','Paiement refusé.':l==='fr'?'Paiement refusé.':'Payment declined.','Paiement Mobile Money refusé.':l==='fr'?'Paiement Mobile Money refusé.':'Mobile Money payment declined.','Opération Mobile Money refusée.':l==='fr'?'Opération Mobile Money refusée.':'Mobile Money operation declined.' } as any)[e]||e;
export async function handleUssdRequest(sessionId:string,phoneNumber:string,text=''){const s=await getSession(sessionId,phoneNumber),u:any=await getUserForUssd(s.phone_number),i=current(text),country=await getCountryByPhone(s.phone_number);if(!u){if(!i){await save(s,{state:'REGISTER'},'REGISTER');return `CON ${T.fr.register}`;}if(i==='0')return 'END Merci.';if(i!=='1')return `CON ${T.fr.register}`;const lang='fr-FR',name=country?.name||'République Démocratique du Congo',code=country?.code||'CD',link=`https://app.cashpay-all.com/complete-profile?phone=${encodeURIComponent(s.phone_number)}&country=${encodeURIComponent(code)}&countryName=${encodeURIComponent(name)}&lang=${encodeURIComponent(lang)}`;
    const registrationMessage=`CashPay All : votre numéro n’est pas encore enregistré. Complétez votre inscription ici : ${link}`;
    await Promise.allSettled([sendSms(s.phone_number,registrationMessage),sendWhatsAppTextMessage(s.phone_number,registrationMessage)]);
    return `END ${T.fr.register.split('\n')[0]}\nLe lien d’inscription a été envoyé par SMS et WhatsApp. Veuillez vérifier vos messages.`;}if(blocked(u.status)){const l=langOf(u.ussd_language);return `END ${T[l].unauthorized}`;}let l:Lang=langOf(u.ussd_language||s.data?.lang);if(!u.ussd_language){if(!i)return `CON ${T.fr.lang}`;l=i==='2'?'en':'fr';const saved=await saveUssdLanguage(u.id,l);if(!saved)return `END ${T.fr.error}`;await save(s,{lang:l,state:'CURRENCY'},'CURRENCY');return currencyMenu(l,country);}const d=s.data||{};d.lang=l;if(!d.currency){const cs=currencies(country),n=Number(i)-1;if(!i||n<0||n>=cs.length){await save(s,{...d,lang:l,state:'CURRENCY'},'CURRENCY');return currencyMenu(l,country);}d.currency=cs[n];await save(s,{...d,lang:l,state:'MENU'},'MENU');return main(u,s,d,l,country);}if(!i)return main(u,s,d,l,country);const state=d.state||s.menu_state;return state!=='MENU'&&state!=='CURRENCY'?flow(u,s,i,d,l,country,state):isAgent(u)?agentMenu(u,s,i,d,l,country):clientMenu(u,s,i,d,l,country);}
function currencyMenu(l:Lang,c:any){return `CON CashPay\n${l==='fr'?'Bienvenue sur CashPay.':'Welcome to CashPay.'}\n${T[l].currency}\n${currencies(c).map((x,n)=>`${n+1}. ${x}`).join('\n')}`;}
async function clientMenu(u:any,s:Session,i:string,d:any,l:Lang,c:any){if(i==='0')return `END ${l==='fr'?'Merci.':'Thank you.'}`;if(i==='1'){await save(s,{...d,state:'BALANCE_PIN'},'BALANCE_PIN');return `CON ${l==='fr'?'Entrez votre code PIN pour consulter le solde :':'Enter your PIN to view your balance:'}`;}if(i==='2'){await save(s,{...d,state:'TRANSFER_MENU'},'TRANSFER_MENU');return `CON ${l==='fr'?'Transfert\n1. Transfert CashPay\n2. Transfert Mobile Money\n3. Banque\n0. Retour':'Transfer\n1. CashPay Transfer\n2. Mobile Money Transfer\n3. Bank\n0. Back'}`;}if(i==='3'){await save(s,{...d,state:'DEPOSIT_METHOD'},'DEPOSIT_METHOD');return `CON ${T[l].deposit}`;}if(i==='4'){await save(s,{...d,state:'WITHDRAW_MENU'},'WITHDRAW_MENU');return `CON ${T[l].withdraw}`;}if(i==='5'){await save(s,{...d,state:'RECEIVE_PROVIDER'},'RECEIVE_PROVIDER');return `CON ${T[l].receive}`;}if(i==='6'){const rs=(await getUssdExchangeRates(u)).filter((r:any)=>r.from_currency===d.currency);if(!rs.length)return `END ${T[l].error}`;await save(s,{...d,state:'EXCHANGE_SELECT',rates:rs},'EXCHANGE_SELECT');return `CON ${l==='fr'?'Taux disponibles':'Available rates'}\n${rs.map((r:any,n:number)=>`${n+1}. 1 ${r.from_currency} = ${r.rate} ${r.to_currency}`).join('\n')}\n${T[l].back}`;}if(i==='7'){await save(s,{...d,state:'SERVICES'},'SERVICES');return `CON ${T[l].services}`;}if(i==='8'){await save(s,{...d,state:'HISTORY_PAGE',page:0},'HISTORY_PAGE');return history(u,s,'0',d,l,true);}if(i==='9'){await save(s,{...d,state:'PROFILE'},'PROFILE');return `END ${profile(u,l,false)}`;}return `CON ${T[l].invalid}\n${T[l].client}`;}
async function flow(u:any,s:Session,i:string,d:any,l:Lang,c:any,state:string){if(state==='LANGUAGE_SETTINGS')return languageSettings(u,s,i,d,l);
if(state==='BECOME_AGENT_CONFIRM')return becomeAgentConfirm(u,s,i,d,l);
if(state==='BECOME_AGENT_PIN')return becomeAgentPin(u,s,i,d,l);
if(state==='BECOME_CLIENT_CONFIRM')return becomeClientConfirm(u,s,i,d,l);
if(state==='CARD_TYPE')return cardType(u,s,i,d,l,c);
if(state==='CARD_PRODUCTS')return cardProducts(u,s,i,d,l,c);
if(state==='CARD_PURCHASE_CONFIRM')return cardPurchaseConfirm(u,s,i,d,l,c);
if(state==='CARD_PURCHASE_PIN')return cardPurchasePin(u,s,i,d,l);
if(state==='CARD_SELECT')return cardSelect(u,s,i,d,l,c);
if(state==='CARD_ACTION')return cardAction(u,s,i,d,l,c);
if(state==='CARD_DETAILS_PIN')return cardDetailsPin(u,s,i,d,l,c);
if(state==='CARD_DETAILS')return cardDetails(u,s,i,d,l);
if(state==='CARD_TRANSACTIONS')return cardTransactions(u,s,i,d,l);
if(state==='CARD_STATUS_CONFIRM')return cardStatusConfirm(u,s,i,d,l,c);if(state==='CARD_PIN_CONFIRM')return cardPinConfirm(u,s,i,d,l,c);if(state==='CARD_PIN_VERIFY')return cardPinVerify(u,s,i,d,l,c);if(state==='CARD_FUNDING_SOURCE')return cardFundingSource(u,s,i,d,l,c);if(state==='CARD_CPK_INPUT')return cardCpkInput(u,s,i,d,l,c);if(state==='CARD_CPK_PIN')return cardCpkPin(u,s,i,d,l,c);if(state==='CARD_TRANSFER_SELECT')return cardTransferSelect(u,s,i,d,l,c);if(state==='CARD_TRANSFER_AMOUNT')return cardTransferAmount(u,s,i,d,l,c);if(state==='CARD_TRANSFER_CONFIRM')return cardTransferConfirm(u,s,i,d,l,c);if(state==='CARD_TERMINATE_CONFIRM')return cardTerminateConfirm(u,s,i,d,l,c);if(state==='REGISTER')return i==='1'?`END ${l==='fr'?'Le lien d’inscription vous sera envoyé.':'Your registration link request has been received. Please check your messages.'}`:`END ${l==='fr'?'Merci.':'Thank you.'}`;if(state==='BALANCE_PIN')return balancePin(u,s,i,d,l,c);if(state==='TRANSFER_MENU')return transferMenu(u,s,i,d,l,c);if(state==='WITHDRAW_MENU')return withdrawMenu(u,s,i,d,l,c);if(state==='CLIENT_AGENT_ID')return clientAgentId(u,s,i,d,l);if(state==='CLIENT_AGENT_AMOUNT')return clientAgentAmount(u,s,i,d,l);if(state==='CLIENT_AGENT_CONFIRM')return clientAgentConfirm(u,s,i,d,l,c);if(state==='CLIENT_AGENT_PIN')return clientAgentPin(u,s,i,d,l);if(state==='AGENT_WITHDRAW_OTP')return agentWithdrawOtp(u,s,i,d,l);if(state==='CARDS_MENU')return cardsMenu(u,s,i,d,l,c);if(state==='BALANCE')return balanceChannel(u,s,i,d,l,c);if(state==='BALANCE_CHANNEL')return balanceChannel(u,s,i,d,l,c);if(state==='TRANSFER_ID')return transferId(u,s,i,d,l);if(state==='TRANSFER_AMOUNT')return transferAmount(u,s,i,d,l);if(state==='TRANSFER_CONFIRM')return transferConfirm(u,s,i,d,l,c);if(state==='TRANSFER_PIN')return transferPin(u,s,i,d,l);if(state==='EXCHANGE_SELECT')return exchangeSelect(u,s,i,d,l);if(state==='EXCHANGE_AMOUNT')return exchangeAmount(u,s,i,d,l);if(state==='EXCHANGE_CONFIRM')return exchangeConfirm(u,s,i,d,l,c);if(state==='EXCHANGE_PIN')return exchangePin(u,s,i,d,l);if(state==='SERVICES')return services(u,s,i,d,l);if(state==='AGENT_REPAYMENT')return agentRepayment(u,s,i,d,l);if(state==='STARLINK_MENU')return starlinkMenuHandler(u,s,i,d,l);if(state==='LOAN_ME')return loanMe(u,s,i,d,l,c);if(state==='LOAN_REQUEST_AMOUNT')return loanRequestAmount(u,s,i,d,l);if(state==='LOAN_REQUEST_DURATION')return loanRequestDuration(u,s,i,d,l);if(state==='LOAN_REQUEST_CONFIRM')return loanRequestConfirm(u,s,i,d,l,c);if(state==='LOAN_REPAY_AMOUNT')return loanRepayAmount(u,s,i,d,l);if(state==='LOAN_REPAY_PIN')return loanRepayPin(u,s,i,d,l);if(state==='LOAN_SCHEDULE')return loanSchedule(u,s,i,d,l);
if(state==='LOAN_SCHEDULE_PAGE')return loanSchedule(u,s,i,d,l);if(state==='LOAN_INSTALLMENT_SELECT')return loanInstallmentSelect(u,s,i,d,l);if(state==='LOAN_INSTALLMENT_PIN')return loanInstallmentPin(u,s,i,d,l);if(state==='LOAN_HISTORY')return loanHistory(u,s,i,d,l);if(state==='SETTINGS')return settings(u,s,i,d,l);if(state==='PIN_OLD')return pinOld(u,s,i,d,l);if(state==='PIN_NEW')return pinNew(u,s,i,d,l);if(state==='PIN_CONFIRM')return pinConfirm(u,s,i,d,l);if(state==='TV_OPERATOR')return tvOperator(u,s,i,d,l);if(state==='TV_PACKAGE')return tvPackage(u,s,i,d,l);if(state==='TV_CARD')return tvCard(u,s,i,d,l);if(state==='TV_CONFIRM')return tvConfirm(u,s,i,d,l);if(state==='TV_PIN')return tvPin(u,s,i,d,l);if(state==='RECEIVE_PROVIDER')return receiveProvider(u,s,i,d,l);if(state==='CLAIM_TRACK')return claimTrack(u,s,i,d,l);if(state==='CLAIM_AMOUNT')return claimAmount(u,s,i,d,l);if(state==='CLAIM_SENDER_COUNTRY')return claimSenderCountry(u,s,i,d,l);if(state==='CLAIM_RECEIVE_CURRENCY')return claimReceiveCurrency(u,s,i,d,l);if(state==='CLAIM_PIN')return claimPin(u,s,i,d,l);if(state==='CLAIM_HISTORY')return claimHistory(u,s,d,l);if(state==='DEPOSIT_METHOD'||state==='WITHDRAW_METHOD')return paymentMethod(u,s,i,d,l,state);if(state==='PAYMENT_REQUEST')return paymentRequest(u,s,i,d,l,c);if(state==='MM_COUNTRY')return mmCountry(u,s,i,d,l);if(state==='MM_OPERATOR')return mmOperator(u,s,i,d,l);if(state==='MM_PHONE')return mmPhone(u,s,i,d,l);if(state==='MM_AMOUNT')return mmAmount(u,s,i,d,l);if(state==='MM_CONFIRM')return mmConfirm(u,s,i,d,l,c);if(state==='MM_PIN')return mmPin(u,s,i,d,l);if(state==='CARD_CHANNEL')return cardChannel(u,s,i,d,l);if(state==='CARD_AMOUNT')return cardAmount(u,s,i,d,l);if(state==='CARD_LINK')return cardLink(u,s,i,d,l);if(state==='HISTORY_PAGE')return history(u,s,i,d,l);if(state==='AGENT_METHOD')return agentMethod(u,s,i,d,l);if(state==='AGENT_ID')return agentId(u,s,i,d,l);if(state==='AGENT_AMOUNT')return agentAmount(u,s,i,d,l);if(state==='AGENT_CONFIRM')return agentConfirm(u,s,i,d,l,c);if(state==='AGENT_OTP_CHANNEL')return agentOtpChannel(u,s,i,d,l);if(state==='AGENT_PIN')return agentPin(u,s,i,d,l);if(state==='AGENT_MM_OPERATOR')return agentMmOperator(u,s,i,d,l);if(state==='AGENT_MM_CONFIRM')return agentMmConfirm(u,s,i,d,l,c);if(state==='AGENT_MM_PIN')return agentMmPin(u,s,i,d,l);if(state==='AGENT_BALANCE_PIN')return agentBalancePin(u,s,i,d,l);if(state==='AGENT_COMM_PIN')return agentCommViewPin(u,s,i,d,l);if(state==='COMM_MENU')return commMenu(u,s,i,d,l);if(state==='COMM_AMOUNT')return commAmount(u,s,i,d,l);if(state==='COMM_PIN')return commPin(u,s,i,d,l);if(state==='AGENT_SERVICES')return agentServices(u,s,i,d,l);if(state==='AGENT_LOAN_REPAY_ID')return agentLoanRepayId(u,s,i,d,l);if(state==='AGENT_LOAN_REPAY_AMOUNT')return agentLoanRepayAmount(u,s,i,d,l);if(state==='AGENT_LOAN_REPAY_CONFIRM')return agentLoanRepayConfirm(u,s,i,d,l);if(state==='AGENT_LOAN_REPAY_PIN')return agentLoanRepayPin(u,s,i,d,l);return back(u,s,d,l,c);}
async function back(u:any,s:Session,d:any,l:Lang,c:any){await save(s,{...d,state:'MENU'},'MENU');return main(u,s,d,l,c);}
async function balancePin(u:any,s:Session,i:string,d:any,l:Lang,c:any){const p=await verifyUserPin(u.id,i);if(!p.success)return `CON ${l==='fr'?'Code PIN incorrect.':'Incorrect PIN.'}`;const b=await getUssdBalance(u.id,d.currency);await save(s,{...d,state:'BALANCE'},'BALANCE');return `CON ${l==='fr'?'Solde':'Balance'} : ${b.toFixed(2)} ${d.currency}\n${l==='fr'?'1. Recevoir par SMS\n2. Recevoir par WhatsApp\n3. Recevoir par e-mail\n0. Retour':'1. Receive by SMS\n2. Receive by WhatsApp\n3. Receive by email\n0. Back'}`;}
async function balanceChannel(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  if(i==='0')return back(u,s,d,l,c);
  const channel=i==='1'?'sms':i==='2'?'whatsapp':i==='3'?'email':null;
  if(!channel)return `CON ${T[l].invalid}`;
  const balance=await getUssdBalance(u.id,d.currency);
  const message=l==='fr'
    ? `CashPay : votre solde ${d.currency} est de ${balance.toFixed(2)} ${d.currency}. Demande effectuée via USSD.`
    : `CashPay: your ${d.currency} balance is ${balance.toFixed(2)} ${d.currency}. Requested via USSD.`;
  const result=await ussdExplicitChannelAlert(u,channel,l==='fr'?'Solde CashPay':'CashPay Balance',message,{channel,currency:d.currency,balance});
  await save(s,{...d,state:'BALANCE',balanceChannel:channel},'BALANCE');
  const label=channel==='sms'?'SMS':channel==='whatsapp'?'WhatsApp':'e-mail';
  return `END ${result?.success
    ? (l==='fr'?`Votre solde a été envoyé par ${label}.`:`Your balance was sent by ${label}.`)
    : (l==='fr'?`Impossible d’envoyer le solde par ${label}. Veuillez réessayer.`:`Unable to send the balance by ${label}. Please try again.`)}`;
}

async function transferId(u:any,s:Session,i:string,d:any,l:Lang){const r=await getUssdRecipientInfo(i);if(!r.success)return `CON ${err(r.error,l)}\n${T[l].back}`;d.recipient=i;d.recipientInfo=r;await save(s,{...d,state:'TRANSFER_AMOUNT'},'TRANSFER_AMOUNT');return `CON ${l==='fr'?`Destinataire: ${r.firstName||'Client'}\nID Wallet: ${r.walletId}`:`Recipient: ${r.firstName||'Client'}\nWallet ID: ${r.walletId}`}\n${l==='fr'?'Saisie montant :':'Enter amount:'}`;}
async function transferAmount(u:any,s:Session,i:string,d:any,l:Lang){const a=Number(i);if(!Number.isFinite(a)||a<=0)return `CON ${T[l].invalidAmount}`;const f=Number(await getUssdFee(a,d.currency,'WD',u.country));d.amount=a;d.fee=f;await save(s,{...d,state:'TRANSFER_CONFIRM'},'TRANSFER_CONFIRM');return `CON ${l==='fr'?'Transfert CashPay':'CashPay Transfer'}\n${l==='fr'?`Destinataire: ${d.recipientInfo.firstName||'Client'}\nID Wallet: ${d.recipientInfo.walletId}`:`Recipient: ${d.recipientInfo.firstName||'Client'}\nWallet ID: ${d.recipientInfo.walletId}`}\n${l==='fr'?'Saisie montant':'Enter amount'}: ${a.toFixed(2)} ${d.currency}\n${l==='fr'?'Frais':'Fee'}: ${f.toFixed(2)} ${d.currency}\n${l==='fr'?'Total':'Total'}: ${(a+f).toFixed(2)} ${d.currency}\n${T[l].confirm}`;}
async function transferConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){if(i==='0')return back(u,s,d,l,c);if(i!=='1')return `CON ${T[l].invalid}`;await save(s,{...d,state:'TRANSFER_PIN'},'TRANSFER_PIN');return `CON ${T[l].pin}`;}
async function transferPin(u:any,s:Session,i:string,d:any,l:Lang){const x=await executeUssdTransfer(u,d.recipient,d.amount,d.currency,i);await save(s,{...d,state:'MENU'},'MENU');return done(!!x.success,l,(x as any).reference,err((x as any).error||'',l));}
async function exchangeSelect(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));const r=d.rates?.[Number(i)-1];if(!r)return `CON ${T[l].invalid}`;await save(s,{...d,state:'EXCHANGE_AMOUNT',rate:r},'EXCHANGE_AMOUNT');return `CON ${T[l].amount}`;}
async function exchangeAmount(u:any,s:Session,i:string,d:any,l:Lang){const a=Number(i);if(!Number.isFinite(a)||a<=0)return `CON ${T[l].invalidAmount}`;d.amount=a;await save(s,{...d,state:'EXCHANGE_CONFIRM'},'EXCHANGE_CONFIRM');return `CON ${a.toFixed(2)} ${d.currency} = ${(a*Number(d.rate.rate)).toFixed(2)} ${d.rate.to_currency}\n${T[l].confirm}`;}
async function exchangeConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){if(i==='0')return back(u,s,d,l,c);if(i!=='1')return `CON ${T[l].invalid}`;await save(s,{...d,state:'EXCHANGE_PIN'},'EXCHANGE_PIN');return `CON ${T[l].pin}`;}
async function exchangePin(u:any,s:Session,i:string,d:any,l:Lang){const x=await executeUssdExchange(u,d.amount,d.currency,d.rate.to_currency,Number(d.rate.rate),i);await save(s,{...d,state:'MENU'},'MENU');return done(!!x.success,l,(x as any).reference,err((x as any).error||'',l));}
async function transferMenu(u:any,s:Session,i:string,d:any,l:Lang,c:any){
 if(i==='0')return back(u,s,d,l,c);
 if(i==='1'){await save(s,{...d,state:'TRANSFER_ID',transferType:'cashpay'},'TRANSFER_ID');return `CON ${T[l].id}`;}
 if(i==='2'){await save(s,{...d,state:'MM_COUNTRY',paymentDirection:'withdraw',mmPayout:true},'MM_COUNTRY');return `CON ${l==='fr'?'Transfert Mobile Money - Pays\n':'Mobile Money Transfer - Country\n'}${countryMenu()}\n${T[l].back}`;}
 if(i==='3')return `CON ${l==='fr'?'Banque\nLe transfert bancaire sera disponible prochainement.\n0. Retour':'Bank\nBank transfer will be available soon.\n0. Back'}`;
 return `CON ${T[l].invalid}`;
}
async function withdrawMenu(u:any,s:Session,i:string,d:any,l:Lang,c:any){if(i==='0')return back(u,s,d,l,c);if(i==='1'){await save(s,{...d,state:'CLIENT_AGENT_ID',withdrawType:'agent_cash'},'CLIENT_AGENT_ID');return `CON ${l==='fr'?'Retrait Agent Cash\nEntrez l’ID Wallet ou le numéro de téléphone de l’agent :':'Cash Agent Withdrawal\nEnter the agent Wallet ID or phone number:'}`;}if(i==='3'){await save(s,{...d,state:'AGENT_WITHDRAW_OTP'},'AGENT_WITHDRAW_OTP');return `CON ${l==='fr'?'Entrez l’OTP reçu pour autoriser le retrait :':'Enter the OTP received to authorize the withdrawal:'}`;}if(i==='2')return `CON ${l==='fr'?'Retrait ATM\nLe retrait ATM sera activé avec le token ATM et la validation OTP.\n0. Retour':'ATM Withdrawal\nATM withdrawal will be activated with the ATM token and OTP confirmation.\n0. Back'}`;return `CON ${T[l].invalid}`;}
async function clientAgentId(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,'');const a=await getUssdRecipientInfo(i);if(!a.success)return `CON ${l==='fr'?'Agent introuvable.':'Agent not found.'}`;const {rows}=await db.query('SELECT 1 FROM boutiques WHERE agent_id=$1 LIMIT 1',[a.userId]);if(!rows.length)return `CON ${l==='fr'?'Cet utilisateur n’est pas un agent CashPay.':'This user is not a CashPay agent.'}`;await save(s,{...d,state:'CLIENT_AGENT_AMOUNT',agent:i,agentInfo:a},'CLIENT_AGENT_AMOUNT');return `CON ${l==='fr'?`Agent : ${a.firstName||'Agent'}\nID : ${a.walletId}\nEntrez le montant :`:`Agent: ${a.firstName||'Agent'}\nID: ${a.walletId}\nEnter amount:`}`;}
async function clientAgentAmount(u:any,s:Session,i:string,d:any,l:Lang){const a=Number(i);if(!Number.isFinite(a)||a<=0)return `CON ${T[l].invalidAmount}`;const f=Number(await getUssdFee(a,d.currency,'WD',u.country));await save(s,{...d,state:'CLIENT_AGENT_CONFIRM',amount:a,fee:f},'CLIENT_AGENT_CONFIRM');return `CON ${a.toFixed(2)} ${d.currency}\n${l==='fr'?'Frais':'Fee'}: ${f.toFixed(2)} ${d.currency}\n${l==='fr'?'Total débité':'Total debited'}: ${(a+f).toFixed(2)} ${d.currency}\n${T[l].confirm}`;}
async function clientAgentConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){if(i==='0')return back(u,s,d,l,c);if(i!=='1')return `CON ${T[l].invalid}`;await save(s,{...d,state:'CLIENT_AGENT_PIN'},'CLIENT_AGENT_PIN');return `CON ${T[l].pin}`;}
async function clientAgentPin(u:any,s:Session,i:string,d:any,l:Lang){const x=await executeClientAgentWithdrawal(u,d.agent,d.amount,d.currency,i);await save(s,{...d,state:'MENU'},'MENU');return done(!!x.success,l,(x as any).reference,err((x as any).error||'',l));}
async function agentWithdrawOtp(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,'');const x=await confirmWithdrawal({agent:u,clientWalletId:d.client,amount:Number(d.amount),currency:d.currency,code:i,method:'otp'});await save(s,{...d,state:'MENU'},'MENU');return done(!!x.success,l,(x as any).reference,err((x as any).error||'',l));}
async function cardsMenu(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  if(i==='0')return services(u,s,'0',d,l);

  if(i==='1'){
    await save(
      s,
      {...d,state:'CARD_TYPE'},
      'CARD_TYPE'
    );

    return `CON ${l==='fr'
      ? `Achat / commande de carte
Devise : ${d.currency}
1. Carte virtuelle
2. Carte physique
0. Retour`
      : `Buy / order a card
Currency : ${d.currency}
1. Virtual card
2. Physical card
0. Back`}`;
  }

  if(i==='2'){
    const cards=await getCardsForUser(u.id, u.full_name);

    const currencyCards=(cards||[]).filter(
      (x:any)=>String(x.currency||'').toUpperCase()===String(d.currency||'').toUpperCase()
    );

    if(!currencyCards.length){
      return `CON ${l==='fr'
        ? `Mes cartes
Devise : ${d.currency}

Aucune carte disponible pour cette devise.
0. Retour`
        : `My cards
Currency : ${d.currency}

No card available for this currency.
0. Back`}`;
    }

    await save(
      s,
      {
        ...d,
        state:'CARD_SELECT',
        cards:currencyCards
      },
      'CARD_SELECT'
    );

    return `CON ${l==='fr'
      ? `Mes cartes
Devise : ${d.currency}

${currencyCards.map((x:any,n:number)=>
`${n+1}. ${String(x.brand||'').toUpperCase()} •••• ${x.last4||'----'}
   ${x.currency} • ${x.card_type==='virtuelle'?'Virtuelle':'Physique'}`
      ).join('\n\n')}
0. Retour`
      : `My cards
Currency : ${d.currency}

${currencyCards.map((x:any,n:number)=>
`${n+1}. ${String(x.brand||'').toUpperCase()} •••• ${x.last4||'----'}
   ${x.currency} • ${x.card_type==='virtuelle'?'Virtual':'Physical'}`
      ).join('\n\n')}
0. Back`}`;
  }

  return `CON ${T[l].invalid}`;
}

async function cardType(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  if(i==='0')return cardsMenu(u,s,'0',d,l,c);
  if(i!=='1'&&i!=='2')return `CON ${T[l].invalid}`;

  const cardType=i==='1'?'virtuelle':'physique';
  const options=await getUssdCardPurchaseOptions(d.currency,cardType,c?.code||u.country);
  const balance=Number(await getUssdBalance(u.id,d.currency));

  if(!options.length){
    return `CON ${l==='fr'
      ? 'Aucun produit de carte disponible pour cette devise/type.'
      : 'No card product is available for this currency/type.'}
Solde : ${balance.toFixed(2)} ${d.currency}
0. ${l==='fr'?'Retour':'Back'}`;
  }

  await save(s,{...d,state:'CARD_PRODUCTS',cardType,cardOptions:options,cardWalletBalance:balance},'CARD_PRODUCTS');

  return `CON ${l==='fr'
    ? `${cardType==='virtuelle'?'Cartes virtuelles':'Cartes physiques'}
Devise : ${d.currency}
Solde disponible : ${balance.toFixed(2)} ${d.currency}

${options.map((x:any,n:number)=>`${n+1}. ${String(x.brand||'').toUpperCase()}
   Prix : ${Number(x.fee).toFixed(2)} ${d.currency}${x.configured?'':'\n   Indisponible'}`).join('\n\n')}
0. Retour`
    : `${cardType==='virtuelle'?'Virtual cards':'Physical cards'}
Currency : ${d.currency}
Available balance : ${balance.toFixed(2)} ${d.currency}

${options.map((x:any,n:number)=>`${n+1}. ${String(x.brand||'').toUpperCase()}
   Price : ${Number(x.fee).toFixed(2)} ${d.currency}${x.configured?'':'\n   Unavailable'}`).join('\n\n')}
0. Back`}`;
}

async function cardProducts(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  if(i==='0')return cardType(u,s,'0',d,l,c);

  const opt=d.cardOptions?.[Number(i)-1];

  if(!opt||!opt.configured)
    return `CON ${l==='fr'
      ? 'Option de carte indisponible.'
      : 'Card option unavailable.'}`;

  await save(
    s,
    {
      ...d,
      state:'CARD_PURCHASE_CONFIRM',
      selectedCardOption:opt
    },
    'CARD_PURCHASE_CONFIRM'
  );

  return `CON ${l==='fr'
    ? `${d.cardType==='virtuelle'
        ? 'Achat carte'
        : 'Commande carte'}
${String(opt.brand||'').toUpperCase()}
Devise : ${d.currency}
Prix : ${Number(opt.fee).toFixed(2)} ${d.currency}
Solde disponible : ${Number(d.cardWalletBalance ?? await getUssdBalance(u.id,d.currency)).toFixed(2)} ${d.currency}

1. Confirmer
0. Annuler`
    : `${d.cardType==='virtuelle'
        ? 'Card purchase'
        : 'Card order'}
${String(opt.brand||'').toUpperCase()}
Currency : ${d.currency}
Price : ${Number(opt.fee).toFixed(2)} ${d.currency}
Available balance : ${Number(d.cardWalletBalance ?? await getUssdBalance(u.id,d.currency)).toFixed(2)} ${d.currency}

1. Confirm
0. Cancel`}`;
}

async function cardPurchaseConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  if(i==='0')return cardsMenu(u,s,'1',d,l,c);

  if(i!=='1')
    return `CON ${T[l].invalid}`;

  await save(
    s,
    {...d,state:'CARD_PURCHASE_PIN'},
    'CARD_PURCHASE_PIN'
  );

  return `CON ${T[l].pin}`;
}

async function cardPurchasePin(u:any,s:Session,i:string,d:any,l:Lang){
  const opt=d.selectedCardOption;

  if(!opt)
    return `END ${T[l].error}`;

  const x=await executeUssdCardPurchase(
    u,
    d.cardType,
    opt.brand,
    d.currency,
    i
  );

    if(x.success){
    await ussdAlert(u,l==='fr'?'Carte achetée':'Card purchase',
      l==='fr'?`Votre achat/demande de carte ${String(opt.brand||'').toUpperCase()} ${d.cardType==='physique'?'physique':'virtuelle'} a été traité via USSD.`:`Your ${String(opt.brand||'').toUpperCase()} ${d.cardType==='physique'?'physical':'virtual'} card purchase/order was processed via USSD.`,
      'card',{event:'CARD_PURCHASE',brand:opt.brand,cardType:d.cardType,currency:d.currency,reference:(x as any).reference||''});
  }
  await save(
    s,
    {...d,state:'MENU'},
    'MENU'
  );

  if(!x.success)
    return `END ${err(x.error||T[l].error,l)}`;

  if(d.cardType==='physique'){
    return `END ${l==='fr'
      ? 'Votre demande de carte physique a été enregistrée.'
      : 'Your physical card order has been registered.'}`;
  }

  return `END ${l==='fr'
    ? `Carte ${String(opt.brand||'').toUpperCase()} virtuelle attribuée avec succès.`
    : `${String(opt.brand||'').toUpperCase()} virtual card issued successfully.`}`;
}

async function cardDetailsPin(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const card=d.selectedCard;
  if(!card)return cardsMenu(u,s,'2',d,l,c);
  const pin=String(i||'').trim();
  if(!/^\d{4,6}$/.test(pin))
    return `CON ${l==='fr'?'Code PIN invalide.':'Invalid PIN.'}`;

  const verified=await verifyUserPin(u.id,pin);
  if(!verified.success)
    return `CON ${l==='fr'?'Code PIN incorrect.':'Incorrect PIN.'}`;

  const details=await revealCardDetails(String(card.id),u.id);
  if(!details?.success)
    return `CON ${l==='fr'?(details?.error||'Impossible de récupérer les détails de la carte.'):(details?.error||'Unable to retrieve card details.')}\n0. ${l==='fr'?'Retour':'Back'}`;

  await ussdAlert(
    u,
    l==='fr'?'Détails de carte consultés':'Card details viewed',
    l==='fr'?`Les détails de la carte ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'} ont été consultés via USSD.`:`The ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'} card details were viewed via USSD.`,
    'card',
    {event:'CARD_DETAILS_VIEWED',cardId:String(card.id),channel:'USSD'}
  );

  const number=String(details.number||'').trim();
  const cvv=String(details.cvv||'').trim();
  const expiry=String(details.expiry||'').trim();
  const numberDisplay=number || `•••• •••• •••• ${card.last4||'----'}`;
  return `CON ${l==='fr'
    ? `Détails de la carte\nNuméro : ${numberDisplay}\nCVV : ${cvv||'***'}\nExpiration : ${expiry||'--/----'}\nDevise : ${card.currency||d.currency}\nMarque : ${String(card.brand||'').toUpperCase()}\n0. Retour`
    : `Card details\nNumber: ${numberDisplay}\nCVV: ${cvv||'***'}\nExpiry: ${expiry||'--/----'}\nCurrency: ${card.currency||d.currency}\nBrand: ${String(card.brand||'').toUpperCase()}\n0. Back`}`;
}

async function cardDetails(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return cardAction(u,s,'0',d,l,await getCountryByPhone(u.phone));
  const details=d.cardDetails;
  if(!details)return cardAction(u,s,'0',d,l,await getCountryByPhone(u.phone));

  const expiry=String(
    details.expiry||
    details.expiration||
    (d.selectedCard?.exp_month&&d.selectedCard?.exp_year
      ? `${String(d.selectedCard.exp_month).padStart(2,'0')}/${String(d.selectedCard.exp_year)}`
      : '')
  );

  return `CON ${l==='fr'
    ? `Détails de la carte

Numéro : ${details.cardNumber||details.number||'•••• •••• ••••'}
CVV : ${details.cvv||'***'}
Expiration : ${expiry||'--/----'}
Devise : ${d.selectedCard?.currency||d.currency}
Statut : ${d.selectedCard?.status||'unknown'}

0. Retour`
    : `Card details

Number : ${details.cardNumber||details.number||'•••• •••• ••••'}
CVV : ${details.cvv||'***'}
Expiry : ${expiry||'--/----'}
Currency : ${d.selectedCard?.currency||d.currency}
Status : ${d.selectedCard?.status||'unknown'}

0. Back`}`;
}

async function cardTransactions(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return cardAction(u,s,'0',d,l,await getCountryByPhone(u.phone));
  const txs=Array.isArray(d.cardTransactions)?d.cardTransactions:[];
  if(i==='9'){
    const page=Number(d.cardTransactionPage||1)+1;
    const result=await getCardTransactionsAction(String(d.selectedCard?.id||''),u.id,page,5);
    if(!result.success||!result.transactions?.length)return `CON ${l==='fr'?'Aucune transaction supplémentaire.':'No additional transactions.'}\n0. ${l==='fr'?'Retour':'Back'}`;
    await save(s,{...d,state:'CARD_TRANSACTIONS',cardTransactions:result.transactions,cardTransactionPage:page},'CARD_TRANSACTIONS');
    return cardTransactions(u,s,'1',{...d,cardTransactions:result.transactions,cardTransactionPage:page},l);
  }
  if(!txs.length)return `CON ${l==='fr'?'Aucune transaction pour cette carte.':'No transactions for this card.'}\n0. ${l==='fr'?'Retour':'Back'}`;
  return `CON ${l==='fr'?'Transactions de la carte':'Card transactions'}\n\n${txs.map((r:any)=>{const dt=new Date(r.date);const stamp=new Intl.DateTimeFormat(l==='fr'?'fr-FR':'en-US',{dateStyle:'short',timeStyle:'short'}).format(dt);return `${String(r.type||'Opération')} ${Number(r.amount||0).toFixed(2)} ${r.currency||d.currency}\n${r.description||''}\n${stamp}`;}).join('\n\n')}\n\n${txs.length===5?'9. '+(l==='fr'?'Suivant':'Next')+'\n':''}0. ${l==='fr'?'Retour':'Back'}`;
}

async function cardStatusConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const card=d.selectedCard;if(!card)return cardsMenu(u,s,'2',d,l,c);
  if(i==='0')return cardAction(u,s,'0',d,l,c);if(i!=='1')return `CON ${T[l].invalid}`;
  const current=String(card.status||'').toLowerCase();
  const desired=current==='active'?'inactive':'active';
  const result=await toggleCardStatus(String(card.id),desired);
  if(!result?.success)return `CON ${l==='fr'?(result?.error||'Impossible de modifier le statut de la carte.'):(result?.error||'Unable to change card status.')}\n0. ${l==='fr'?'Retour':'Back'}`;
  const updatedCard={...card,...(result.card||{}),status:result.card?.status||desired};
  await save(s,{...d,state:'CARD_ACTION',selectedCard:updatedCard},'CARD_ACTION');
  await ussdAlert(u,l==='fr'?'Carte modifiée':'Card status changed',
    l==='fr'?`La carte ${String(updatedCard.brand||'').toUpperCase()} •••• ${updatedCard.last4||'----'} est maintenant ${updatedCard.status}.`:`Card ${String(updatedCard.brand||'').toUpperCase()} •••• ${updatedCard.last4||'----'} is now ${updatedCard.status}.`,
    'card',{event:'CARD_STATUS_CHANGED',cardId:String(card.id),status:updatedCard.status,channel:'USSD'});
  return `CON ${l==='fr'?`Carte ${updatedCard.status==='active'?'dégelée':'gelée'} avec succès.\n\nCarte : ${String(updatedCard.brand||'').toUpperCase()} •••• ${updatedCard.last4||'----'}\nStatut : ${updatedCard.status}\n\n0. Retour`:`Card ${updatedCard.status==='active'?'unfrozen':'frozen'} successfully.\n\nCard : ${String(updatedCard.brand||'').toUpperCase()} •••• ${updatedCard.last4||'----'}\nStatus : ${updatedCard.status}\n\n0. Back`}`;
}

async function cardPinConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const card=d.selectedCard;if(!card)return cardsMenu(u,s,'2',d,l,c);if(i==='0')return cardAction(u,s,'0',d,l,c);
  const newPin=String(i||'').trim();
  if(!/^\d{4,6}$/.test(newPin)){await save(s,{...d,state:'CARD_PIN_CONFIRM'},'CARD_PIN_CONFIRM');return `CON ${l==='fr'?'Le PIN doit contenir 4 à 6 chiffres.\nEntrez le nouveau PIN de la carte :':'The PIN must contain 4 to 6 digits.\nEnter the new card PIN:'}`;}
  await save(s,{...d,state:'CARD_PIN_VERIFY',newCardPin:newPin},'CARD_PIN_VERIFY');return `CON ${l==='fr'?'Confirmez le nouveau PIN de la carte :':'Confirm the new card PIN:'}`;
}

async function cardPinVerify(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const card=d.selectedCard;if(!card)return cardsMenu(u,s,'2',d,l,c);if(i==='0')return cardAction(u,s,'0',d,l,c);
  const confirmation=String(i||'').trim();
  if(confirmation!==String(d.newCardPin||'')){await save(s,{...d,state:'CARD_PIN_CONFIRM'},'CARD_PIN_CONFIRM');return `CON ${l==='fr'?'Les PIN ne correspondent pas.\nEntrez le nouveau PIN de la carte :':'The PINs do not match.\nEnter the new card PIN:'}`;}
  const result=await setCardPin(String(card.id),u.id,confirmation);
  if(!result?.success)return `CON ${l==='fr'?(result?.error||'Impossible de modifier le PIN.'):(result?.error||'Unable to change the PIN.')}\n0. ${l==='fr'?'Retour':'Back'}`;
    await ussdAlert(u,l==='fr'?'PIN de carte modifié':'Card PIN changed',
    l==='fr'?`Le PIN de votre carte ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'} a été modifié via USSD.`:`The PIN of your card ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'} was changed via USSD.`,
    'card',{event:'CARD_PIN_CHANGED',cardId:String(card.id),channel:'USSD'});
const cleanData={...d};delete cleanData.newCardPin;await save(s,{...cleanData,state:'CARD_ACTION'},'CARD_ACTION');return `CON ${l==='fr'?'PIN de la carte modifié avec succès.\n0. Retour':'Card PIN changed successfully.\n0. Back'}`;
}

async function cardFundingSource(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const card=d.selectedCard;if(!card)return cardsMenu(u,s,'2',d,l,c);if(i==='0')return cardAction(u,s,'0',d,l,c);
  if(i==='1'){
    const result=await updateSpendingSource(String(card.id),'wallet');
    if(!result?.success)return `CON ${l==='fr'?(result?.error||'Impossible de définir le Wallet comme source.'):(result?.error||'Unable to set Wallet as funding source.')}\n0. ${l==='fr'?'Retour':'Back'}`;
    await save(s,{...d,state:'CARD_ACTION',selectedCard:{...card,spending_source_type:'wallet'}},'CARD_ACTION');return `CON ${l==='fr'?`Source de financement définie.\n\nWallet ${card.currency||d.currency}\n\n0. Retour`:`Funding source updated.\n\nWallet ${card.currency||d.currency}\n\n0. Back`}`;
    await ussdAlert(u,l==='fr'?'Source de financement modifiée':'Funding source changed',
      l==='fr'?`La carte ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'} utilise maintenant le Wallet.`:`Card ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'} now uses the Wallet.`,
      'card',{event:'CARD_FUNDING_SOURCE_CHANGED',cardId:String(card.id),source:'wallet',channel:'USSD'});
  }
  if(i==='2'){await save(s,{...d,state:'CARD_CPK_INPUT'},'CARD_CPK_INPUT');return `CON ${l==='fr'?'Entrez la clé CPK :':'Enter the CPK key:'}`;}
  return `CON ${T[l].invalid}`;
}

async function cardCpkInput(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const card=d.selectedCard;
  if(!card)return cardsMenu(u,s,'2',d,l,c);
  if(i==='0')return cardAction(u,s,'0',d,l,c);

  const cpkSignature=String(i||'').trim();
  if(!cpkSignature)
    return `CON ${l==='fr'?'Clé CPK invalide.':'Invalid CPK key.'}`;

  await save(
    s,
    {...d,state:'CARD_CPK_PIN',cpkSignature},
    'CARD_CPK_PIN'
  );

  return `CON ${l==='fr'
    ? 'Entrez le PIN du certificat CPK :'
    : 'Enter the CPK certificate PIN:'}`;
}

async function cardCpkPin(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const card=d.selectedCard;
  if(!card)return cardsMenu(u,s,'2',d,l,c);
  if(i==='0')return cardAction(u,s,'0',d,l,c);

  const cpkPin=String(i||'').trim();
  if(!cpkPin)
    return `CON ${l==='fr'?'PIN CPK invalide.':'Invalid CPK PIN.'}`;

  const result=await linkCpkToCard(
    String(card.id),
    String(d.cpkSignature||''),
    cpkPin
  );

  if(!result?.success)
    return `CON ${l==='fr'
      ? (result?.error||'Impossible de lier la CPK à la carte.')
      : (result?.error||'Unable to link CPK to the card.')}
0. ${l==='fr'?'Retour':'Back'}`;

    await ussdAlert(u,l==='fr'?'CPK liée à la carte':'CPK linked to card',
    l==='fr'?`Une clé CPK a été liée à votre carte ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'} via USSD.`:`A CPK key was linked to your card ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'} via USSD.`,
    'card',{event:'CARD_CPK_LINKED',cardId:String(card.id),channel:'USSD'});
const cleanData={...d};
  delete cleanData.cpkSignature;

  await save(
    s,
    {
      ...cleanData,
      state:'CARD_ACTION',
      selectedCard:{
        ...card,
        spending_source_type:'cpk'
      }
    },
    'CARD_ACTION'
  );

  return `CON ${l==='fr'
    ? 'CPK liée à la carte avec succès.\n0. Retour'
    : 'CPK linked to the card successfully.\n0. Back'}`;
}

async function cardTransferSelect(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const source=d.selectedCard;if(!source)return cardsMenu(u,s,'2',d,l,c);if(i==='0')return cardAction(u,s,'0',d,l,c);
  const cards=d.cardTransferTargets||await getCardsForUser(u.id, u.full_name);const sameCurrencyCards=(cards||[]).filter((x:any)=>String(x.currency||'').toUpperCase()===String(d.currency||'').toUpperCase()&&String(x.id)!==String(source.id));
  if(!sameCurrencyCards.length)return `CON ${l==='fr'?`Aucune autre carte disponible en ${d.currency}.\n\n0. Retour`:`No other card available in ${d.currency}.\n\n0. Back`}`;
  const target=sameCurrencyCards[Number(i)-1];if(!target)return `CON ${T[l].invalid}`;
  await save(s,{...d,state:'CARD_TRANSFER_AMOUNT',transferTargetCard:target},'CARD_TRANSFER_AMOUNT');return `CON ${l==='fr'?`Transfert vers\n\nCarte : ${String(target.brand||'').toUpperCase()} •••• ${target.last4||'----'}\nDevise : ${target.currency}\n\nEntrez le montant :`:`Transfer to\n\nCard : ${String(target.brand||'').toUpperCase()} •••• ${target.last4||'----'}\nCurrency : ${target.currency}\n\nEnter amount:`}`;
}

async function cardTransferAmount(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const source=d.selectedCard,target=d.transferTargetCard;if(!source||!target)return cardsMenu(u,s,'2',d,l,c);if(i==='0')return cardAction(u,s,'0',d,l,c);
  const amount=Number(i);if(!Number.isFinite(amount)||amount<=0)return `CON ${T[l].invalidAmount}`;
  if(String(target.currency||'').toUpperCase()!==String(d.currency||'').toUpperCase())return `CON ${l==='fr'?'La carte destinataire doit utiliser la même devise.':'The destination card must use the same currency.'}`;
  await save(s,{...d,state:'CARD_TRANSFER_CONFIRM',transferAmount:amount},'CARD_TRANSFER_CONFIRM');return `CON ${l==='fr'?`Transfert entre cartes\n\nDe : ${String(source.brand||'').toUpperCase()} •••• ${source.last4||'----'}\nVers : ${String(target.brand||'').toUpperCase()} •••• ${target.last4||'----'}\n\nMontant : ${amount.toFixed(2)} ${d.currency}\n\n1. Confirmer\n0. Annuler`:`Card transfer\n\nFrom : ${String(source.brand||'').toUpperCase()} •••• ${source.last4||'----'}\nTo : ${String(target.brand||'').toUpperCase()} •••• ${target.last4||'----'}\n\nAmount : ${amount.toFixed(2)} ${d.currency}\n\n1. Confirm\n0. Cancel`}`;
}

async function cardTransferConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const source=d.selectedCard,target=d.transferTargetCard;if(!source||!target)return cardsMenu(u,s,'2',d,l,c);if(i==='0')return cardAction(u,s,'0',d,l,c);if(i!=='1')return `CON ${T[l].invalid}`;
  const result=await transferBetweenCards({user:u,fromCardId:String(source.id),toCardId:String(target.id),amount:Number(d.transferAmount)});
  if(!result?.success)return `CON ${l==='fr'?(result?.error||'Transfert impossible.'):(result?.error||'Transfer failed.')}\n0. ${l==='fr'?'Retour':'Back'}`;
  await save(s,{...d,state:'CARD_ACTION'},'CARD_ACTION');return `CON ${l==='fr'?`Transfert effectué avec succès.\n\nMontant : ${Number(d.transferAmount).toFixed(2)} ${d.currency}\n\n0. Retour`:`Transfer completed successfully.\n\nAmount : ${Number(d.transferAmount).toFixed(2)} ${d.currency}\n\n0. Back`}`;
  await ussdAlert(u,l==='fr'?'Transfert entre cartes':'Card transfer',
    l==='fr'?`Transfert de ${Number(d.transferAmount).toFixed(2)} ${d.currency} effectué entre vos cartes via USSD.`:`A ${Number(d.transferAmount).toFixed(2)} ${d.currency} transfer was completed between your cards via USSD.`,
    'transaction',{event:'CARD_TRANSFER',fromCardId:String(source.id),toCardId:String(target.id),amount:Number(d.transferAmount),currency:d.currency,channel:'USSD'});
}

async function cardTerminateConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const card=d.selectedCard;if(!card)return cardsMenu(u,s,'2',d,l,c);if(i==='0')return cardAction(u,s,'0',d,l,c);if(i!=='1')return `CON ${T[l].invalid}`;
  const result=await terminateCard(String(card.id),u.id);if(!result?.success)return `CON ${l==='fr'?(result?.error||'Impossible de résilier la carte.'):(result?.error||'Unable to terminate the card.')}\n0. ${l==='fr'?'Retour':'Back'}`;
  await save(s,{...d,state:'CARDS_MENU'},'CARDS_MENU');return `CON ${l==='fr'?'Carte résiliée avec succès.\n0. Retour':'Card terminated successfully.\n0. Back'}`;
  await ussdAlert(u,l==='fr'?'Carte résiliée':'Card terminated',
    l==='fr'?`Votre carte ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'} a été résiliée via USSD.`:`Your card ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'} was terminated via USSD.`,
    'card',{event:'CARD_TERMINATED',cardId:String(card.id),channel:'USSD'});
}

async function cardSelect(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  if(i==='0')return cardsMenu(u,s,'2',d,l,c);

  const card=d.cards?.[Number(i)-1];

  if(!card)
    return `CON ${T[l].invalid}`;

  if(
    String(card.currency||'').toUpperCase() !==
    String(d.currency||'').toUpperCase()
  ){
    return `CON ${l==='fr'
      ? 'Carte indisponible pour cette devise.'
      : 'Card unavailable for this currency.'}`;
  }

  const realCard=await getCardById(
    String(card.id),
    u.id
  );

  if(!realCard)
    return `CON ${l==='fr'
      ? 'Carte introuvable.'
      : 'Card not found.'}`;

  await save(
    s,
    {
      ...d,
      state:'CARD_ACTION',
      selectedCard:realCard
    },
    'CARD_ACTION'
  );

  const brand=String(
    realCard.brand||card.brand||''
  ).toUpperCase();

  const type=realCard.card_type==='virtuelle'
    ? (l==='fr'?'Virtuelle':'Virtual')
    : (l==='fr'?'Physique':'Physical');

  return `CON ${l==='fr'
    ? `Carte ${brand} •••• ${realCard.last4||card.last4||'----'}
Devise : ${realCard.currency||card.currency}
Marque : ${brand}
Type : ${type}
Statut : ${realCard.status}

1. Détails de la carte
2. Transactions
3. Geler / Dégeler la carte
4. Modifier le PIN
5. Source de financement
6. Transférer vers une autre carte
7. Résilier la carte
0. Retour`
    : `Card ${brand} •••• ${realCard.last4||card.last4||'----'}
Currency : ${realCard.currency||card.currency}
Brand : ${brand}
Type : ${type}
Status : ${realCard.status}

1. Card details
2. Transactions
3. Freeze / Unfreeze card
4. Change PIN
5. Funding source
6. Transfer to another card
7. Terminate card
0. Back`}`;
}

async function cardAction(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  const card=d.selectedCard;

  if(!card)
    return cardsMenu(u,s,'2',d,l,c);

  if(i==='0')
    return cardsMenu(u,s,'2',d,l,c);

  if(i==='1'){
    await save(
      s,
      {...d,state:'CARD_DETAILS_PIN'},
      'CARD_DETAILS_PIN'
    );

    return `CON ${l==='fr'
      ? 'Entrez votre PIN pour voir les détails de la carte :'
      : 'Enter your PIN to view the card details:'}`;
  }

  if(i==='2'){
    const result=await getCardTransactionsAction(
      String(card.id),
      u.id,
      1,
      5
    );

    if(!result.success){
      return `CON ${l==='fr'
        ? 'Impossible de récupérer les transactions.'
        : 'Unable to retrieve card transactions.'}
0. ${l==='fr'?'Retour':'Back'}`;
    }

    const txs=Array.isArray(result.transactions)
      ? result.transactions
      : [];

    if(!txs.length){
      return `CON ${l==='fr'
        ? 'Aucune transaction pour cette carte.'
        : 'No transactions for this card.'}
0. ${l==='fr'?'Retour':'Back'}`;
    }

    await save(
      s,
      {...d,state:'CARD_TRANSACTIONS',cardTransactions:txs,cardTransactionPage:1},
      'CARD_TRANSACTIONS'
    );

    return cardTransactions(
      u,
      s,
      '0',
      {...d,cardTransactions:txs},
      l
    );
  }

  if(i==='3'){
    await save(
      s,
      {...d,state:'CARD_STATUS_CONFIRM',cardStatusAction:'toggle'},
      'CARD_STATUS_CONFIRM'
    );

    return `CON ${l==='fr'
      ? `Geler / Dégeler la carte ?
Carte : ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'}
Statut actuel : ${card.status}

1. Confirmer
0. Annuler`
      : `Freeze / Unfreeze card?
Card : ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'}
Current status : ${card.status}

1. Confirm
0. Cancel`}`;
  }

  if(i==='4'){
    await save(
      s,
      {...d,state:'CARD_PIN_CONFIRM'},
      'CARD_PIN_CONFIRM'
    );

    return `CON ${l==='fr'
      ? 'Entrez le nouveau PIN de la carte :'
      : 'Enter the new card PIN:'}`;
  }

  if(i==='5'){
    await save(
      s,
      {...d,state:'CARD_FUNDING_SOURCE'},
      'CARD_FUNDING_SOURCE'
    );

    return `CON ${l==='fr'
      ? `Source de financement
Carte : ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'}
Devise : ${card.currency||d.currency}

Source principale :
Wallet ${card.currency||d.currency}

Source alternative :
Aucune

1. Wallet ${card.currency||d.currency}
2. CPK
0. Retour`
      : `Funding source
Card : ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'}
Currency : ${card.currency||d.currency}

Primary source :
Wallet ${card.currency||d.currency}

Alternative source :
None

1. Wallet ${card.currency||d.currency}
2. CPK
0. Back`}`;
  }

  if(i==='6'){
    const cards=await getCardsForUser(u.id, u.full_name);
    const sameCurrencyCards=(cards||[]).filter((x:any)=>String(x.currency||'').toUpperCase()===String(d.currency||'').toUpperCase()&&String(x.id)!==String(card.id));
    if(!sameCurrencyCards.length){
      return `CON ${l==='fr'?`Aucune autre carte disponible en ${d.currency}.\n0. Retour`:`No other card available in ${d.currency}.\n0. Back`}`;
    }
    await save(s,{...d,state:'CARD_TRANSFER_SELECT',cardTransferTargets:sameCurrencyCards},'CARD_TRANSFER_SELECT');
    return `CON ${l==='fr'?`Transférer vers une autre carte\nDevise : ${d.currency}\n\n${sameCurrencyCards.map((x:any,n:number)=>`${n+1}. ${String(x.brand||'').toUpperCase()} •••• ${x.last4||'----'}`).join('\n')}\n0. Retour`:`Transfer to another card\nCurrency : ${d.currency}\n\n${sameCurrencyCards.map((x:any,n:number)=>`${n+1}. ${String(x.brand||'').toUpperCase()} •••• ${x.last4||'----'}`).join('\n')}\n0. Back`}`;
  }

  if(i==='7'){
    await save(
      s,
      {...d,state:'CARD_TERMINATE_CONFIRM'},
      'CARD_TERMINATE_CONFIRM'
    );

    return `CON ${l==='fr'
      ? `Résilier la carte ?
Carte : ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'}

1. Confirmer
0. Annuler`
      : `Terminate card?
Card : ${String(card.brand||'').toUpperCase()} •••• ${card.last4||'----'}

1. Confirm
0. Cancel`}`;
  }

  return `CON ${T[l].invalid}`;
}

async function services(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));
  if(i==='1'){
    if(isAgent(u)) return agentServices(u,s,'0',d,l);
    await save(s,{...d,state:'CARDS_MENU'},'CARDS_MENU');
    return `CON ${l==='fr'?'Cartes\n1. Acheter une carte\n2. Mes cartes\n0. Retour':'Cards\n1. Buy a card\n2. My cards\n0. Back'}`;
  }
  if(i==='2'){await save(s,{...d,state:'TV_OPERATOR'},'TV_OPERATOR');return `CON ${T[l].tv}`;}
  if(i==='3')return `CON ${l==='fr'?'Airtime : service de paiement disponible prochainement.':'Airtime: payment service available soon.'}\n${T[l].back}`;
  if(i==='4'){
    await save(s,{...d,state:'SETTINGS'},'SETTINGS');
    return settingsMenu(u,l);
  }
  if(i==='5'){
    if(isAgent(u)) return agentServices(u,s,'0',d,l);
    await save(s,{...d,state:'LOAN_ME'},'LOAN_ME');
    return loanMe(u,s,'',d,l,await getCountryByPhone(u.phone));
  }
  if(i==='6'){
    if(isAgent(u)) return agentServices(u,s,'0',d,l);
    await save(s,{...d,state:'STARLINK_MENU'},'STARLINK_MENU');
    return starlinkMenu(l);
  }
  return `CON ${T[l].invalid}`;
}

function starlinkMenu(l:Lang){
  return `CON ${l==='fr'
    ? 'Starlink\n1. État de la connexion\n2. Diagnostiquer\n3. Trouver le signal\n4. Redémarrer\n0. Retour'
    : 'Starlink\n1. Connection status\n2. Diagnose\n3. Find signal\n4. Restart\n0. Back'}`;
}

async function starlinkMenuHandler(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return services(u,s,'0',d,l);
  const info:any=await getClientTerminalInfo(u.id);
  const terminal:any=info?.data || info?.terminal || null;
  if(i==='1'){
    if(!info?.success || !terminal)
      return `CON ${l==='fr'?'Aucun terminal Starlink n’est lié à votre compte.\n0. Retour':'No Starlink terminal is linked to your account.\n0. Back'}`;
    const online=terminal.online ?? terminal.status ?? terminal.state ?? 'inconnu';
    return `CON ${l==='fr'?`Starlink\nÉtat : ${String(online)}\nSignal : ${terminal.signal ?? terminal.signalStrength ?? 'N/D'}\n0. Retour`:`Starlink\nStatus: ${String(online)}\nSignal: ${terminal.signal ?? terminal.signalStrength ?? 'N/A'}\n0. Back`}`;
  }
  if(!info?.success || !terminal)
    return `CON ${l==='fr'?'Aucun terminal Starlink n’est lié à votre compte.\n0. Retour':'No Starlink terminal is linked to your account.\n0. Back'}`;
  const accountId=String(terminal.accountId||terminal.account_id||terminal.account||'');
  const terminalId=String(terminal.id||terminal.terminalId||terminal.terminal_id||'');
  if(!accountId || !terminalId)
    return `CON ${l==='fr'?'Terminal Starlink mal configuré.\n0. Retour':'Starlink terminal is not fully configured.\n0. Back'}`;
  if(i==='2' || i==='3'){
    const diag:any=await runDiagnostics(accountId,terminalId);
    if(!diag?.success)return `CON ${l==='fr'?'Diagnostic indisponible.\n0. Retour':'Diagnostics unavailable.\n0. Back'}`;
    const diagnosticId=String(diag?.data?.diagnosticId||diag?.diagnosticId||'');
    if(!diagnosticId)return `CON ${l==='fr'?'Diagnostic lancé.\n0. Retour':'Diagnostics started.\n0. Back'}`;
    const result:any=await getDiagnosticResults(accountId,terminalId,diagnosticId);
    const r=result?.data?.results || result?.results || {};
    const ping=r?.ping_stats || {};
    const obstruction=r?.obstruction || {};
    return `CON ${l==='fr'
      ? `Diagnostic Starlink\nÉtat : ${result?.data?.status||result?.status||'terminé'}\nLatence : ${ping.latency_ms ?? 'N/D'} ms\nPerte : ${ping.drop_rate ?? 'N/D'}%\nObstruction : ${obstruction.fraction ?? 'N/D'}\n\n0. Retour`
      : `Starlink diagnostics\nStatus: ${result?.data?.status||result?.status||'complete'}\nLatency: ${ping.latency_ms ?? 'N/A'} ms\nDrop: ${ping.drop_rate ?? 'N/A'}%\nObstruction: ${obstruction.fraction ?? 'N/A'}\n\n0. Back`}`;
  }
  if(i==='4'){
    const result:any=await rebootUserTerminal(accountId,terminalId);
    return `CON ${l==='fr'
      ? (result?.success?'Redémarrage Starlink demandé.\n0. Retour':'Impossible de redémarrer Starlink.\n0. Retour')
      : (result?.success?'Starlink restart requested.\n0. Back':'Unable to restart Starlink.\n0. Back')}`;
  }
  return `CON ${T[l].invalid}`;
}

async function loanMe(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  if(i==='0')return services(u,s,'0',d,l);
  await processLoanRepayments().catch(()=>null);
  const loan:any=await getLoanForUser(u.id);
  if(i==='1'){
    const offer=await getLoanOffer(u.id,d.currency);
    if(!offer.eligible)return `CON ${l==='fr'?`LoanMe\n${offer.reason||'Demande indisponible.'}\n0. Retour`:`LoanMe\n${offer.reason||'Loan request unavailable.'}\n0. Back`}`;
    await save(s,{...d,state:'LOAN_REQUEST_AMOUNT',loanOffer:offer},'LOAN_REQUEST_AMOUNT');
    return `CON ${l==='fr'?`Demander un prêt\nDevise : ${d.currency}\nGarantie minimale : 20%\nSolde disponible : ${offer.balance.toFixed(2)} ${d.currency}\n${T[l].amount}`:`Request loan\nCurrency: ${d.currency}\nMinimum guarantee: 20%\nAvailable balance: ${offer.balance.toFixed(2)} ${d.currency}\n${T[l].amount}`}`;
  }
  if(i==='2'){
    const history=await getLoanHistory(u.id);
    const current=history.find((x:any)=>['pending','approved'].includes(String(x.status||'').toLowerCase()));
    if(!current)return `CON ${l==='fr'?'Aucun prêt en cours.\n0. Retour':'No current loan.\n0. Back'}`;
    if(String(current.status).toLowerCase()==='pending')
      return `CON ${l==='fr'?`Demande de prêt #${current.id}\nStatut : en attente de décision.\nMontant : ${Number(current.amount).toFixed(2)} ${current.currency}\n0. Retour`:`Loan request #${current.id}\nStatus: pending decision.\nAmount: ${Number(current.amount).toFixed(2)} ${current.currency}\n0. Back`}`;
    await save(s,{...d,state:'LOAN_SCHEDULE',loanId:current.id,loanSchedulePage:0},'LOAN_SCHEDULE');
    return `CON ${l==='fr'?`Mon prêt #${current.id}\nDette restante: ${Number(current.remaining_balance).toFixed(2)} ${current.currency}\nFréquence: ${current.repayment_frequency==='weekly'?'hebdomadaire':'mensuelle'}\n1. Rembourser maintenant\n2. Échéancier\n0. Retour`:`My loan #${current.id}\nRemaining: ${Number(current.remaining_balance).toFixed(2)} ${current.currency}\nFrequency: ${current.repayment_frequency==='weekly'?'weekly':'monthly'}\n1. Repay now\n2. Schedule\n0. Back`}`;
  }
  if(i==='3'){
    if(!loan)return `CON ${l==='fr'?'Aucun prêt actif.\n0. Retour':'No active loan.\n0. Back'}`;
    await save(s,{...d,state:'LOAN_REPAY_AMOUNT',loanId:loan.id},'LOAN_REPAY_AMOUNT');
    return `CON ${l==='fr'?`Remboursement prêt #${loan.id}\nRestant: ${Number(loan.remaining_balance).toFixed(2)} ${loan.currency}\nEntrez le montant à rembourser :`:`Loan #${loan.id} repayment\nRemaining: ${Number(loan.remaining_balance).toFixed(2)} ${loan.currency}\nEnter repayment amount:`}`;
  }
  if(i==='4'){
    if(!loan)return `CON ${l==='fr'?'Aucun prêt actif.\n0. Retour':'No active loan.\n0. Back'}`;
    await save(s,{...d,state:'LOAN_SCHEDULE',loanId:loan.id,loanSchedulePage:0},'LOAN_SCHEDULE');
    return loanSchedule(u,s,'0',{...d,state:'LOAN_SCHEDULE',loanId:loan.id,loanSchedulePage:0},l);
  }
  if(i==='5'){
    await save(s,{...d,state:'LOAN_HISTORY',loanHistoryPage:0},'LOAN_HISTORY');
    return loanHistory(u,s,'0',{...d,state:'LOAN_HISTORY',loanHistoryPage:0},l);
  }
  return `CON ${l==='fr'?'Loan Me\n1. Demander un prêt\n2. Mes prêts\n3. Rembourser\n4. Échéancier\n5. Historique\n0. Retour':'Loan Me\n1. Request loan\n2. My loans\n3. Repay\n4. Schedule\n5. History\n0. Back'}`;
}

async function loanRequestAmount(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return loanMe(u,s,'0',d,l,await getCountryByPhone(u.phone));
  const amount=Number(i), offer=d.loanOffer;
  if(!offer||!offer.eligible)return `CON ${l==='fr'?'Offre LoanMe indisponible.\n0. Retour':'LoanMe offer unavailable.\n0. Back'}`;
  if(!Number.isFinite(amount)||amount<=0)return `CON ${T[l].invalidAmount}`;
  const guarantee=amount*Number(offer.guaranteeRate||0.20);
  if(Number(offer.balance||0)+0.005<guarantee)return `CON ${l==='fr'?`Solde de garantie insuffisant.\nIl faut ${guarantee.toFixed(2)} ${d.currency} (20%).\nSolde: ${Number(offer.balance).toFixed(2)} ${d.currency}\n0. Retour`:`Insufficient guarantee balance.\nYou need ${guarantee.toFixed(2)} ${d.currency} (20%).\nBalance: ${Number(offer.balance).toFixed(2)} ${d.currency}\n0. Back`}`;
  await save(s,{...d,state:'LOAN_REQUEST_DURATION',loanAmount:amount},'LOAN_REQUEST_DURATION');
  return `CON ${l==='fr'?`Durée pour ${amount.toFixed(2)} ${d.currency}\n${offer.durations.map((x:number,n:number)=>`${n+1}. ${x} mois`).join('\n')}\n0. Retour`:`Duration for ${amount.toFixed(2)} ${d.currency}\n${offer.durations.map((x:number,n:number)=>`${n+1}. ${x} month${x>1?'s':''}`).join('\n')}\n0. Back`}`;
}

async function loanRequestDuration(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return loanMe(u,s,'1',d,l,await getCountryByPhone(u.phone));
  const offer=d.loanOffer; const index=Number(i)-1; const duration=Number(offer?.durations?.[index]);
  if(!offer||!Number.isFinite(duration))return `CON ${T[l].invalid}`;
  const amount=Number(d.loanAmount); const total=amount*(1+(Number(offer.interestRate)/100*duration)); const count=duration===1?4:duration; const installment=total/count;
  await save(s,{...d,state:'LOAN_REQUEST_CONFIRM',loanAmount:amount,loanDuration:duration,loanTotal:total,loanInstallment:installment},'LOAN_REQUEST_CONFIRM');
  return `CON ${l==='fr'?`LoanMe\nMontant: ${amount.toFixed(2)} ${d.currency}\nDurée: ${duration} mois\nTaux: ${Number(offer.interestRate).toFixed(2)}%\nTotal à rembourser: ${total.toFixed(2)} ${d.currency}\nÉchéance: ${installment.toFixed(2)} ${d.currency} (${duration===1?'hebdomadaire':'mensuelle'})\n1. Confirmer\n0. Annuler`:`LoanMe\nAmount: ${amount.toFixed(2)} ${d.currency}\nDuration: ${duration} month${duration>1?'s':''}\nRate: ${Number(offer.interestRate).toFixed(2)}%\nTotal repayment: ${total.toFixed(2)} ${d.currency}\nInstallment: ${installment.toFixed(2)} ${d.currency} (${duration===1?'weekly':'monthly'})\n1. Confirm\n0. Cancel`}`;
}

async function loanRequestConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){
  if(i==='0')return loanMe(u,s,'0',d,l,c);
  if(i!=='1')return `CON ${T[l].invalid}`;
  const amount=Number(d.loanAmount),duration=Number(d.loanDuration),offer=d.loanOffer;
  const x=await createLoanApplication({user:u,amount,currency:d.currency,interestRate:Number(offer?.interestRate),durationMonths:duration,purpose:'USSD LoanMe'});
  await save(s,{...d,state:'MENU'},'MENU');
  return x.success?`END ${l==='fr'?'Demande de prêt enregistrée. Vous serez notifié après décision.':'Loan request submitted. You will be notified after a decision.'}`:`CON ${x.error||T[l].failed}\n0. Retour`;
}

async function loanRepayAmount(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return loanMe(u,s,'0',d,l,await getCountryByPhone(u.phone));
  const amount=Number(i); if(!Number.isFinite(amount)||amount<=0)return `CON ${l==='fr'?'Montant invalide.':'Invalid amount.'}`;
  await save(s,{...d,state:'LOAN_REPAY_PIN',loanId:d.loanId,loanRepayAmount:amount},'LOAN_REPAY_PIN');
  return `CON ${l==='fr'?`Confirmez le remboursement de ${amount.toFixed(2)} ${d.currency}\nEntrez votre PIN :`:`Confirm repayment of ${amount.toFixed(2)} ${d.currency}\nEnter your PIN:`}`;
}

async function loanRepayPin(u:any,s:Session,i:string,d:any,l:Lang){
  const pin=await verifyUserPin(u.id,i); if(!pin.success)return `CON ${l==='fr'?'Code PIN incorrect.':'Incorrect PIN.'}`;
  const x=await repayLoan(u.id,Number(d.loanId),Number(d.loanRepayAmount));
  await save(s,{...d,state:'MENU'},'MENU');
  return x.success
    ? `END ${l==='fr'?`Remboursement effectué: ${Number(x.paid).toFixed(2)} ${d.currency}.\nDette restante: ${Number(x.remaining).toFixed(2)} ${d.currency}.`:`Repayment completed: ${Number(x.paid).toFixed(2)} ${d.currency}.\nRemaining debt: ${Number(x.remaining).toFixed(2)} ${d.currency}.`}`
    : `CON ${x.error||T[l].failed}\n0. Retour`;
}

async function loanSchedule(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0'){
    if(d.state==='LOAN_SCHEDULE' || d.state==='LOAN_SCHEDULE_PAGE' || !d.state){
      const h=await getLoanHistory(u.id);
      const loan:any=h.find((x:any)=>Number(x.id)===Number(d.loanId)) || h.find((x:any)=>String(x.status).toLowerCase()==='approved');
      if(!loan)return `CON ${l==='fr'?'Aucun échéancier disponible.\n0. Retour':'No schedule available.\n0. Back'}`;
      const page=Math.max(0,Number(d.loanSchedulePage||0));
      const size=3;
      const schedule=(Array.isArray(loan.schedule)?loan.schedule:[]).filter((x:any)=>String(x.status).toLowerCase()!=='paid' && Number(x.remaining_amount)>0.005);
      const items=schedule.slice(page*size,(page+1)*size);
      const hasNext=(page+1)*size<schedule.length;
      const hasPrevious=page>0;
      await save(s,{...d,state:'LOAN_SCHEDULE',loanId:loan.id,loanSchedulePage:page},'LOAN_SCHEDULE');
      if(!items.length && !hasPrevious){
        const fullyRepaid=Number(loan.remaining_balance)<=0.005 || String(loan.status).toLowerCase()==='repaid';
        return `CON ${l==='fr'?`Échéancier prêt #${loan.id}\n${fullyRepaid?'Toutes les échéances sont soldées. Dette entièrement remboursée.':'Aucune échéance restante à rembourser.'}\n0. Retour`:`Loan #${loan.id} schedule\n${fullyRepaid?'All installments are settled. Loan fully repaid.':'No outstanding installment.'}\n0. Back`}`;
      }
      if(!items.length && hasPrevious){
        return loanSchedule(u,s,'9',{...d,state:'LOAN_SCHEDULE',loanId:loan.id,loanSchedulePage:page-1},l);
      }
      const rows=items.map((x:any,idx:number)=>`${idx+1}. #${x.installment_number} | ${new Date(x.due_date).toLocaleDateString(l==='fr'?'fr-FR':'en-US',{day:'2-digit',month:'2-digit'})}\n   ${Number(x.remaining_amount).toFixed(2)} ${loan.currency}${Number(x.penalty)>0.005?` + Pén.${Number(x.penalty).toFixed(2)}`:''}`);
      const nav=`${hasPrevious?'8. '+(l==='fr'?'Précédent':'Previous')+'\n':''}${hasNext?'9. '+(l==='fr'?'Suivant':'Next'):'0. '+(l==='fr'?'Retour':'Back')}`;
      return `CON ${l==='fr'?`Échéancier #${loan.id}\n${rows.join('\n')}\n\n1. Rembourser\n${nav}`:`Schedule #${loan.id}\n${rows.join('\n')}\n\n1. Pay\n${nav}`}`;
    }
  }
  if(i==='1'){
    return loanInstallmentSelect(u,s,'0',{...d,state:'LOAN_INSTALLMENT_SELECT',loanInstallmentPage:Number(d.loanSchedulePage||0)},l);
  }
  if(i==='8' && Number(d.loanSchedulePage||0)>0){
    return loanSchedule(u,s,'0',{...d,state:'LOAN_SCHEDULE',loanSchedulePage:Number(d.loanSchedulePage||0)-1},l);
  }
  if(i==='9'){
    return loanSchedule(u,s,'0',{...d,state:'LOAN_SCHEDULE',loanSchedulePage:Number(d.loanSchedulePage||0)+1},l);
  }
  return `CON ${l==='fr'?'Choix invalide.\n0. Retour':'Invalid choice.\n0. Back'}`;
}

async function loanInstallmentSelect(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return loanSchedule(u,s,'0',{...d,state:'LOAN_SCHEDULE',loanSchedulePage:Number(d.loanInstallmentPage||0)},l);
  const h=await getLoanHistory(u.id);
  const loan:any=h.find((x:any)=>Number(x.id)===Number(d.loanId)) || h.find((x:any)=>String(x.status).toLowerCase()==='approved');
  if(!loan)return `CON ${l==='fr'?'Aucun prêt actif.\n0. Retour':'No active loan.\n0. Back'}`;
  const schedule=(Array.isArray(loan.schedule)?loan.schedule:[]).filter((x:any)=>String(x.status).toLowerCase()!=='paid' && Number(x.remaining_amount)>0.005);
  const page=Math.max(0,Number(d.loanInstallmentPage||0));
  const size=3;
  const items=schedule.slice(page*size,(page+1)*size);
  const choice=Number(i);
  if(choice===8 && page>0)return loanInstallmentSelect(u,s,'0',{...d,state:'LOAN_INSTALLMENT_SELECT',loanInstallmentPage:page-1},l);
  if(choice===9 && (page+1)*size<schedule.length)return loanInstallmentSelect(u,s,'0',{...d,state:'LOAN_INSTALLMENT_SELECT',loanInstallmentPage:page+1},l);
  if(!Number.isInteger(choice) || choice<1 || choice>items.length)return `CON ${l==='fr'?'Choisissez une échéance affichée.\n0. Retour':'Choose an installment shown.\n0. Back'}`;
  const inst=items[choice-1];
  await save(s,{...d,state:'LOAN_INSTALLMENT_PIN',loanId:loan.id,loanInstallmentId:inst.id,loanInstallmentNumber:inst.installment_number,loanInstallmentAmount:inst.remaining_amount},'LOAN_INSTALLMENT_PIN');
  return `CON ${l==='fr'?`Échéance #${inst.installment_number}\nReste: ${Number(inst.remaining_amount).toFixed(2)} ${loan.currency}\nPIN (paiement anticipé OK):`:`Installment #${inst.installment_number}\nRemaining: ${Number(inst.remaining_amount).toFixed(2)} ${loan.currency}\nPIN (early payment OK):`}`;
}

async function loanInstallmentPin(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return loanInstallmentSelect(u,s,'0',{...d,state:'LOAN_INSTALLMENT_SELECT',loanInstallmentPage:Number(d.loanInstallmentPage||d.loanSchedulePage||0)},l);
  const pin=await verifyUserPin(u.id,i); if(!pin.success)return `CON ${l==='fr'?'Code PIN incorrect.':'Incorrect PIN.'}`;
  const x=await repayLoanInstallment(u.id,Number(d.loanId),Number(d.loanInstallmentId));
  await save(s,{...d,state:'MENU'},'MENU');
  return x.success?`END ${l==='fr'?`Échéance #${x.installmentNumber||d.loanInstallmentNumber} remboursée : ${Number(x.paid).toFixed(2)} ${d.currency||''}.\n${Number(x.remaining||0)>0.005?`Dette restante : ${Number(x.remaining).toFixed(2)} ${d.currency||''}.`:'Dette entièrement remboursée.'}`:`Installment #${x.installmentNumber||d.loanInstallmentNumber} paid: ${Number(x.paid).toFixed(2)} ${d.currency||''}.\n${Number(x.remaining||0)>0.005?`Remaining debt: ${Number(x.remaining).toFixed(2)} ${d.currency||''}.`:'Loan fully repaid.'}`}`:`CON ${x.error||T[l].failed}\n0. Retour`;
}

async function loanHistory(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0' && d.state==='LOAN_HISTORY'){
    const h=await getLoanHistory(u.id);
    const entries:any[]=[];
    for(const loan of h)for(const r of (loan.repayments||[]))entries.push({...r,loanId:loan.id,currency:loan.currency});
    entries.sort((a,b)=>new Date(b.payment_date).getTime()-new Date(a.payment_date).getTime());
    if(!entries.length)return `CON ${l==='fr'?'Historique: aucun mouvement.\n0. Retour':'History: no activity.\n0. Back'}`;
    const page=Math.max(0,Number(d.loanHistoryPage||0)),size=5;
    const items=entries.slice(page*size,(page+1)*size),hasNext=(page+1)*size<entries.length,hasPrevious=page>0;
    await save(s,{...d,state:'LOAN_HISTORY',loanHistoryPage:page},'LOAN_HISTORY');
    const text=items.map((x:any)=>{
      const date=new Date(x.payment_date).toLocaleDateString(l==='fr'?'fr-FR':'en-US',{day:'2-digit',month:'2-digit'});
      const kind=x.type==='penalty'?'PEN':(l==='fr'?'REM':'REP');
      const inst=x.installment_number?` E#${x.installment_number}`:'';
      return `${date} ${kind}${inst}: ${Number(x.amount).toFixed(2)} ${x.currency}${x.debt_remaining!=null?` | D:${Number(x.debt_remaining).toFixed(2)}`:''}`;
    }).join('\n');
    return `CON ${l==='fr'?`Historique LoanMe\n${text}\n\n${hasPrevious?'8. Précédent\n':''}${hasNext?'9. Suivant':'0. Retour'}`:`LoanMe history\n${text}\n\n${hasPrevious?'8. Previous\n':''}${hasNext?'9. Next':'0. Back'}`}`;
  }
  if(i==='8' && d.state==='LOAN_HISTORY' && Number(d.loanHistoryPage||0)>0)return loanHistory(u,s,'0',{...d,state:'LOAN_HISTORY',loanHistoryPage:Number(d.loanHistoryPage)-1},l);
  if(i==='9' && d.state==='LOAN_HISTORY')return loanHistory(u,s,'0',{...d,state:'LOAN_HISTORY',loanHistoryPage:Number(d.loanHistoryPage||0)+1},l);
  return loanMe(u,s,'0',d,l,await getCountryByPhone(u.phone));
}
async function agentRepayment(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return agentServices(u,s,'0',d,l);
  if(i==='1'){
    await save(s,{...d,state:'AGENT_LOAN_REPAY_ID'},'AGENT_LOAN_REPAY_ID');
    return `CON ${l==='fr'?'Remboursement LoanMe\nEntrez le numéro de téléphone ou l’ID Wallet du client créancier :':'LoanMe repayment\nEnter the creditor client phone number or Wallet ID:'}`;
  }
  return `CON ${T[l].invalid}`;
}

async function agentLoanRepayId(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return agentRepayment(u,s,'0',d,l);
  const target=await getAgentLoanRepaymentTarget(i,d.currency);
  if(!target?.success)return `CON ${target?.error||'Client ou prêt introuvable.'}\n0. ${l==='fr'?'Retour':'Back'}`;
  await save(s,{...d,state:'AGENT_LOAN_REPAY_AMOUNT',agentLoanClientId:target.client.id,agentLoanClientName:target.client.first_name||target.client.full_name||'Client',agentLoanClientPhone:target.client.phone,agentLoanClientWalletId:target.client.id_wallet,agentLoanId:target.loan.id,agentLoanDebt:Number(target.loan.remaining_balance),agentLoanCurrency:target.loan.currency},'AGENT_LOAN_REPAY_AMOUNT');
  return `CON ${l==='fr'?`Client: ${target.client.first_name||target.client.full_name||'Client'}\nDette: ${Number(target.loan.remaining_balance).toFixed(2)} ${target.loan.currency}\nMontant à rembourser ?`:`Client: ${target.client.first_name||target.client.full_name||'Client'}\nDebt: ${Number(target.loan.remaining_balance).toFixed(2)} ${target.loan.currency}\nRepay amount?`}`;
}

async function agentLoanRepayAmount(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return agentRepayment(u,s,'0',d,l);
  const amount=Number(i),debt=Number(d.agentLoanDebt||0);
  if(!Number.isFinite(amount)||amount<=0)return `CON ${l==='fr'?'Montant invalide. Entrez un montant positif.':'Invalid amount. Enter a positive amount.'}`;
  if(amount>debt+0.005)return `CON ${l==='fr'?`Le montant dépasse la dette restante (${debt.toFixed(2)} ${d.agentLoanCurrency||d.currency}). Entrez un montant inférieur ou égal à la dette.`:`The amount exceeds the remaining debt (${debt.toFixed(2)} ${d.agentLoanCurrency||d.currency}). Enter an amount no greater than the debt.`}`;
  const balance=Number(await getUssdBalance(u.id,d.currency));
  if(balance+0.005<amount)return `CON ${l==='fr'?`Solde agent insuffisant. Disponible : ${balance.toFixed(2)} ${d.currency}. Débit requis : ${amount.toFixed(2)} ${d.currency}.`:`Insufficient agent balance. Available: ${balance.toFixed(2)} ${d.currency}. Debit required: ${amount.toFixed(2)} ${d.currency}.`}`;
  await save(s,{...d,state:'AGENT_LOAN_REPAY_CONFIRM',agentLoanRepayAmount:amount,agentBalanceBefore:balance},'AGENT_LOAN_REPAY_CONFIRM');
  return `CON ${l==='fr'?`Client: ${d.agentLoanClientName}\nDébit: ${amount.toFixed(2)} ${d.agentLoanCurrency||d.currency}\nCommission: calculée selon la configuration\nDette après: ${Math.max(0,debt-amount).toFixed(2)}\n1. Confirmer\n0. Annuler`:`Client: ${d.agentLoanClientName}\nDebit: ${amount.toFixed(2)} ${d.agentLoanCurrency||d.currency}\nCommission: calculated from configuration\nDebt after: ${Math.max(0,debt-amount).toFixed(2)}\n1. Confirm\n0. Cancel`}`;
}

async function agentLoanRepayConfirm(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return agentRepayment(u,s,'0',d,l);
  if(i!=='1')return `CON ${T[l].invalid}`;
  await save(s,{...d,state:'AGENT_LOAN_REPAY_PIN'},'AGENT_LOAN_REPAY_PIN');
  return `CON ${l==='fr'?'Entrez le PIN de l’agent pour autoriser le débit :':'Enter the agent PIN to authorize the debit:'}`;
}

async function agentLoanRepayPin(u:any,s:Session,i:string,d:any,l:Lang){
  const result=await repayLoanByAgent({agentId:u.id,clientId:Number(d.agentLoanClientId),loanId:Number(d.agentLoanId),amount:Number(d.agentLoanRepayAmount),currency:String(d.agentLoanCurrency||d.currency),pin:String(i)});
  await save(s,{...d,state:'MENU'},'MENU');
  if(!result.success)return `END ${result.error||T[l].error}`;
  const debt=Number(result.remaining||0),commission=Number(result.commission||0),amount=Number(result.paid||0),currency=String(result.currency||d.currency);
  return `END ${l==='fr'?`OK LoanMe\n${amount.toFixed(2)} ${currency} débités\nCommission: ${commission.toFixed(2)} ${currency}\nDette: ${debt.toFixed(2)} ${currency}\nRéf: ${result.reference||'N/A'}`:`LoanMe OK\n${amount.toFixed(2)} ${currency} debited\nCommission: ${commission.toFixed(2)} ${currency}\nDebt: ${debt.toFixed(2)} ${currency}\nRef: ${result.reference||'N/A'}`}`;
}
function settingsMenu(u:any,l:Lang){
  const agent=isAgent(u);
  return `CON ${l==='fr'
    ? `Paramètres\n1. ${agent?'Devenir client':'Devenir agent'}\n2. Changer le code PIN\n3. Changer la langue\n0. Retour`
    : `Settings\n1. ${agent?'Become a client':'Become an agent'}\n2. Change PIN\n3. Change language\n0. Back`}`;
}
async function settings(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));
  if(i==='1'){
    if(isAgent(u)){
      if(['admin'].includes(String(u.role||'').toLowerCase()))return `CON ${l==='fr'?'Le rôle administrateur ne peut pas être retiré par USSD.\n0. Retour':'Administrator role cannot be removed through USSD.\n0. Back'}`;
      await save(s,{...d,state:'BECOME_CLIENT_CONFIRM'},'BECOME_CLIENT_CONFIRM');
      return `CON ${l==='fr'?'Devenir client ?\nVotre menu agent sera désactivé. Aucun remboursement de la période agent ne sera effectué.\n1. Confirmer\n0. Annuler':'Become a client?\nYour agent menu will be disabled. No refund will be issued for the current agent period.\n1. Confirm\n0. Cancel'}`;
    }
    await save(s,{...d,state:'BECOME_AGENT_CONFIRM'},'BECOME_AGENT_CONFIRM');
    return `CON ${l==='fr'?'Activation du rôle agent\nLe forfait agent sera débité de votre solde après confirmation.\n1. Confirmer\n0. Annuler':'Agent role activation\nThe agent plan will be charged from your wallet after confirmation.\n1. Confirm\n0. Cancel'}`;
  }
  if(i==='2'){
    await save(s,{...d,state:'PIN_OLD'},'PIN_OLD');
    return `CON ${l==='fr'?'Ancien code PIN :':'Current PIN:'}`;
  }
  if(i==='3'){
    await save(s,{...d,state:'LANGUAGE_SETTINGS'},'LANGUAGE_SETTINGS');
    return `CON ${l==='fr'?'Changer la langue\n1. Français\n2. English\n0. Retour':'Change language\n1. Français\n2. English\n0. Back'}`;
  }
  return `CON ${T[l].invalid}`;
}
async function languageSettings(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return settings(u,s,'0',d,l);
  if(i!=='1'&&i!=='2')return `CON ${T[l].invalid}\n1. Français\n2. English\n0. ${l==='fr'?'Retour':'Back'}`;
  const next:Lang=i==='2'?'en':'fr';
  const saved=await saveUssdLanguage(u.id,next);
  if(!saved)return `END ${T[l].error}`;
  await save(s,{...d,lang:next,state:'SETTINGS'},'SETTINGS');
  return settingsMenu(u,next);
}
async function becomeAgentConfirm(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return settings(u,s,'0',d,l);
  if(i!=='1')return `CON ${T[l].invalid}`;
  await save(s,{...d,state:'BECOME_AGENT_PIN'},'BECOME_AGENT_PIN');
  return `CON ${T[l].pin}`;
}
async function becomeAgentPin(u:any,s:Session,i:string,d:any,l:Lang){
  const x=await executeBecomeAgent(u,d.currency,i);
  if(!x.success){
    await save(s,{...d,state:'SETTINGS'},'SETTINGS');
    return `CON ${err(x.error||T[l].error,l)}\n${settingsMenu(u,l).replace(/^CON /,'')}`;
  }
  await save(s,{...d,state:'MENU'},'MENU');
  return `END ${l==='fr'?'Rôle agent activé avec succès. Votre menu agent sera disponible à la prochaine session.':'Agent role activated successfully. Your agent menu will be available at the next session.'}`;
}
async function becomeClientConfirm(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return settings(u,s,'0',d,l);
  if(i!=='1')return `CON ${T[l].invalid}`;
  const x=await executeBecomeClient(u);
  if(!x.success)return `CON ${err(x.error||T[l].error,l)}\n0. Retour`;
  await save(s,{...d,state:'MENU'},'MENU');
  return `END ${l==='fr'?'Rôle client activé. Le menu client sera disponible à la prochaine session.':'Client role activated. The client menu will be available at the next session.'}`;
}
async function pinOld(u:any,s:Session,i:string,d:any,l:Lang){const p=await verifyUserPin(u.id,i);if(!p.success)return `CON ${l==='fr'?'Code PIN incorrect.':'Incorrect PIN.'}`;await save(s,{...d,state:'PIN_NEW',oldPin:i},'PIN_NEW');return `CON ${l==='fr'?'Nouveau code PIN :':'New PIN:'}`;}
async function pinNew(u:any,s:Session,i:string,d:any,l:Lang){if(!/^\d{4,6}$/.test(i))return `CON ${l==='fr'?'Code PIN invalide.':'Invalid PIN.'}`;await save(s,{...d,state:'PIN_CONFIRM',newPin:i},'PIN_CONFIRM');return `CON ${l==='fr'?'Confirmez le nouveau code PIN :':'Confirm new PIN:'}`;}
async function pinConfirm(u:any,s:Session,i:string,d:any,l:Lang){if(i!==d.newPin)return `CON ${l==='fr'?'Les codes PIN ne correspondent pas.':'PINs do not match.'}`;try{const verified=await verifyUserPin(u.id,d.oldPin);if(!verified.success)return `CON ${l==='fr'?'Ancien code PIN incorrect.':'Current PIN is incorrect.'}`;const result:any=await (changeUserPin as any)(u.id,d.oldPin,i);if(result?.success===false)return `CON ${err(result.error||'Code PIN incorrect.',l)}`;await save(s,{...d,state:'MENU',oldPin:undefined,newPin:undefined},'MENU');return `END ${l==='fr'?'Code PIN modifié avec succès. Merci d’avoir utilisé CashPay.':'PIN changed successfully. Thank you for using CashPay.'}`;}catch(e:any){return `END ${err(e?.message||T[l].error,l)}`;}}
async function tvOperator(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return isAgent(u)?agentServices(u,s,'0',d,l):services(u,s,'0',d,l);
  const code=({1:'CANALPLUS',2:'STARTIMES',3:'DSTV'} as any)[i];
  if(!code)return `CON ${T[l].invalid}`;
  const p=await getTvPackages(code);
  if(!p.length)return `END ${l==='fr'?'Aucun abonnement disponible pour cet opérateur.':'No subscription is available for this operator.'}`;
  const provider=p[0].provider_code||code;
  await save(s,{...d,state:'TV_PACKAGE',tvProvider:provider,tvProviderName:p[0].provider_name||provider,tvPackages:p},'TV_PACKAGE');
  return `CON ${p[0].provider_name||provider}\n${p.map((x:any,n:number)=>`${n+1}. ${x.package_name} (${Number(x.base_price??x.price_usd).toFixed(2)} ${x.base_currency||'USD'})`).join('\n')}\n${T[l].back}`;
}
async function tvPackage(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return isAgent(u)?agentServices(u,s,'0',d,l):services(u,s,'0',d,l);const p=d.tvPackages?.[Number(i)-1];if(!p)return `CON ${T[l].invalid}`;d.tvPackage=p;await save(s,{...d,state:p.decoder_required||p.card_number_required?'TV_CARD':'TV_CONFIRM',tvPackage:p},p.decoder_required||p.card_number_required?'TV_CARD':'TV_CONFIRM');return p.decoder_required||p.card_number_required?`CON ${l==='fr'?'Numéro Smartcard / décodeur :':'Smartcard / decoder number:'}`:`CON ${p.package_name}\n${Number(p.base_price??p.price_usd).toFixed(2)} ${p.base_currency||'USD'}\n${T[l].confirm}`;}
async function tvCard(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return tvPackage(u,s,'0',d,l);d.smartcard=i;await save(s,{...d,state:'TV_CONFIRM'},'TV_CONFIRM');const p=d.tvPackage;return `CON ${p.package_name}\n${Number(p.base_price??p.price_usd).toFixed(2)} ${p.base_currency||'USD'}\n${T[l].confirm}`;}
async function tvConfirm(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));if(i!=='1')return `CON ${T[l].invalid}`;await save(s,{...d,state:'TV_PIN'},'TV_PIN');return `CON ${T[l].pin}`;}
async function tvPin(u:any,s:Session,i:string,d:any,l:Lang){const x=await executeTvSubscription(u,d.tvProviderName||d.tvProvider,d.smartcard||'',d.tvPackage,d.currency,i);await save(s,{...d,state:'MENU'},'MENU');return done(!!x.success,l,(x as any).reference,err((x as any).error||'',l));}
async function receiveProvider(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));if(i==='4'){await save(s,{...d,state:'CLAIM_HISTORY'},'CLAIM_HISTORY');return claimHistory(u,s,d,l);}const p=({1:'Western Union',2:'MoneyGram',3:'Ria'} as any)[i];if(!p)return `CON ${T[l].invalid}`;await save(s,{...d,state:'CLAIM_TRACK',provider:p},'CLAIM_TRACK');return `CON ${T[l].track}`;}
async function claimTrack(u:any,s:Session,i:string,d:any,l:Lang){if(!i)return `CON ${T[l].track}`;await save(s,{...d,state:'CLAIM_AMOUNT',tracking:i},'CLAIM_AMOUNT');return `CON ${T[l].amount}`;}
async function claimAmount(u:any,s:Session,i:string,d:any,l:Lang){const a=Number(i);if(!Number.isFinite(a)||a<=0)return `CON ${T[l].invalidAmount}`;await save(s,{...d,state:'CLAIM_SENDER_COUNTRY',amount:a},'CLAIM_SENDER_COUNTRY');return `CON ${T[l].senderCountry}`;}
async function claimSenderCountry(u:any,s:Session,i:string,d:any,l:Lang){await save(s,{...d,state:'CLAIM_RECEIVE_CURRENCY',senderCountry:i},'CLAIM_RECEIVE_CURRENCY');return `CON ${T[l].receiveCurrency}`;}
async function claimReceiveCurrency(u:any,s:Session,i:string,d:any,l:Lang){await save(s,{...d,state:'CLAIM_PIN',receiveCurrency:i},'CLAIM_PIN');return `CON ${T[l].pin}`;}
async function claimPin(u:any,s:Session,i:string,d:any,l:Lang){const x=await createInternationalClaim(u,d.provider,d.tracking,d.amount,d.currency,d.senderCountry,d.receiveCurrency,i);await save(s,{...d,state:'MENU'},'MENU');return done(!!x.success,l,(x as any).id,err((x as any).error||'',l));}
async function claimHistory(u:any,s:Session,d:any,l:Lang){const rows=await getInternationalClaims(u.id);if(!rows.length)return `END ${l==='fr'?'Aucune demande trouvée.':'No claims found.'}`;await save(s,{...d,state:'RECEIVE_PROVIDER'},'RECEIVE_PROVIDER');return `CON ${l==='fr'?'Mes demandes':'My claims'}\n${rows.map((r:any)=>`${r.provider}: ${r.tracking_number} - ${r.status}`).join('\n')}\n${T[l].back}`;}
async function paymentRequest(u:any,s:Session,i:string,d:any,l:Lang,c:any){const a=Number(i);if(!Number.isFinite(a)||a<=0)return `CON ${T[l].invalidAmount}`;d.amount=a;if(d.method==='card'){await save(s,{...d,state:'CARD_LINK',amount:a},'CARD_LINK');return cardLink(u,s,'1',d,l);}if(d.paymentDirection==='deposit'){await save(s,{...d,state:'MM_COUNTRY',amount:a},'MM_COUNTRY');return `CON ${l==='fr'?'Choisissez le pays :\n':'Choose country:\n'}${countryMenu()}`;}await save(s,{...d,state:'MM_COUNTRY',amount:a},'MM_COUNTRY');return `CON ${l==='fr'?'Choisissez le pays :\n':'Choose country:\n'}${countryMenu()}`;}
function countryMenu(){return '1. CD - République Démocratique du Congo\n2. CG - Congo\n3. RW - Rwanda\n4. CM - Cameroun\n5. CI - Côte d’Ivoire';}
function countryCode(i:string){return ({1:'CD',2:'CG',3:'RW',4:'CM',5:'CI'} as any)[i];}
function operatorMenu(l:Lang){return l==='fr'?'Opérateur\n1. M-Pesa\n2. Orange Money\n3. Afrimoney\n4. Airtel Money\n5. MTN Mobile Money\n0. Retour':'Operator\n1. M-Pesa\n2. Orange Money\n3. Afrimoney\n4. Airtel Money\n5. MTN Mobile Money\n0. Back';}
function operatorCode(i:string){return ({1:'MPESA',2:'ORANGE',3:'AFRIMONEY',4:'AIRTEL',5:'MTN'} as any)[i];}
async function mmCountry(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));const code=countryCode(i);if(!code)return `CON ${T[l].invalid}`;await save(s,{...d,state:'MM_OPERATOR',mmCountry:code},'MM_OPERATOR');return `CON ${operatorMenu(l)}`;}
async function mmOperator(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));const op=operatorCode(i);if(!op)return `CON ${T[l].invalid}`;await save(s,{...d,state:'MM_PHONE',mmOperator:op},'MM_PHONE');return `CON ${l==='fr'?'Numéro Mobile Money :':'Mobile Money number:'}`;}
async function mmPhone(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));const phone=clean(i);if(phone.length<7)return `CON ${l==='fr'?'Numéro invalide.':'Invalid number.'}`;await save(s,{...d,state:'MM_AMOUNT',mmPhone:phone},'MM_AMOUNT');return `CON ${T[l].amount}`;}
async function mmAmount(u:any,s:Session,i:string,d:any,l:Lang){const a=Number(i);if(!Number.isFinite(a)||a<=0)return `CON ${T[l].invalidAmount}`;const type=d.paymentDirection==='deposit'?'DP_MM':(({MPESA:'WD_MPESA',ORANGE:'WD_ORANGE_MONEY',AFRIMONEY:'WD_AFRIMONEY',AIRTEL:'WD_AIRTEL_MONEY',MTN:'WD_MTN_MOMO'} as any)[d.mmOperator]||'WD'),country=d.mmCountry||u.country,f=Number(await getUssdFee(a,d.currency,type,country));await save(s,{...d,state:'MM_CONFIRM',amount:a,fee:f,feeType:type},'MM_CONFIRM');return `CON ${a.toFixed(2)} ${d.currency}\n${l==='fr'?'Frais':'Fee'}: ${f.toFixed(2)} ${d.currency}\n${l==='fr'?'Total débité':'Total debited'}: ${(a+f).toFixed(2)} ${d.currency}\n${T[l].confirm}`;}
async function mmConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){if(i==='0')return back(u,s,d,l,c);if(i!=='1')return `CON ${T[l].invalid}`;await save(s,{...d,state:'MM_PIN'},'MM_PIN');return `CON ${T[l].pin}`;}
async function mmPin(u:any,s:Session,i:string,d:any,l:Lang){const ref=`USSD-${Date.now()}-${u.id}`;const x=await executeMobileMoneyTransfer(u,d.amount,d.currency,d.mmCountry,d.mmOperator,d.mmPhone,i,ref,d.feeType);await save(s,{...d,state:'MENU'},'MENU');return done(!!x.success,l,(x as any).reference||ref,err((x as any).error||'',l));}
async function cardChannel(u:any,s:Session,i:string,d:any,l:Lang){return paymentRequest(u,s,i,d,l,await getCountryByPhone(u.phone));}
async function cardAmount(u:any,s:Session,i:string,d:any,l:Lang){return paymentRequest(u,s,i,d,l,await getCountryByPhone(u.phone));}
async function cardLink(u:any,s:Session,i:string,d:any,l:Lang){const ref=`USSD-CARD-${Date.now()}-${u.id}`,x=await createMaxiCashGatewayLink(u,d.amount,d.currency,ref,l,'card');await save(s,{...d,state:'MENU',paymentReference:ref,paymentLink:x.link},'MENU');return x.success?`END ${l==='fr'?'Votre lien de paiement a été envoyé. Veuillez vérifier le canal associé à votre compte.':'Your payment link has been sent. Please check the channel associated with your account.'}`:`END ${err(x.error||'',l)}`;}
async function paymentMethod(u:any,s:Session,i:string,d:any,l:Lang,state:string){if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));if(!['1','2'].includes(i))return `CON ${T[l].invalid}`;const method=i==='1'?'card':'mobile_money';await save(s,{...d,state:'PAYMENT_REQUEST',paymentDirection:state==='DEPOSIT_METHOD'?'deposit':'withdraw',method},'PAYMENT_REQUEST');return `CON ${l==='fr'?(method==='card'?'Carte bancaire':'Mobile Money')+'\n'+T[l].amount:(method==='card'?'Bank card':'Mobile Money')+'\n'+T[l].amount}`;}
async function history(u:any,s:Session,i:string,d:any,l:Lang,first=false){if(!first&&i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));const page=first?0:Number(i||0),h=await fetchUssdHistory(u.id,d.currency,page);if(!h.items.length)return `END ${l==='fr'?'Aucune opération trouvée.':'No transactions found.'}`;const labels:any={TR:['Transfert','Transfer'],DP_AGENT:['Dépôt','Deposit'],WD_AGENT:['Retrait','Withdrawal'],MLM_COMM:['Commission','Commission'],MLM_COMM_CLAIM:['Bascule','Commission transfer'],TV:['TV','TV'],EXCHANGE:['Échange','Exchange']};return `CON ${l==='fr'?'Historique':'History'} (${d.currency})\n${h.items.map((r:any)=>{const dt=new Date(r.date);const stamp=new Intl.DateTimeFormat(l==='fr'?'fr-FR':'en-US',{dateStyle:'short',timeStyle:'short'}).format(dt);return `${(labels[r.type]||['Opération','Operation'])[l==='fr'?0:1]} ${r.amount.toFixed(2)} ${r.currency}\n${stamp}`}).join('\n')}\n${h.hasNext?'9. '+T[l].next:T[l].back}`;}
async function agentMenu(u:any,s:Session,i:string,d:any,l:Lang,c:any){if(i==='0')return `END ${l==='fr'?'Merci.':'Thank you.'}`;if(i==='1'||i==='2'){await save(s,{...d,state:'AGENT_METHOD',agentOp:i==='1'?'deposit':'withdraw'},'AGENT_METHOD');return `CON ${l==='fr'?'Mode\n1. CashPay\n2. Carte\n3. Mobile Money\n0. Retour':'Method\n1. CashPay\n2. Card\n3. Mobile Money\n0. Back'}`;}if(i==='3'){await save(s,{...d,state:'AGENT_COMM_PIN'},'AGENT_COMM_PIN');return `CON ${T[l].pin}`;}if(i==='4'){await save(s,{...d,state:'AGENT_BALANCE_PIN'},'AGENT_BALANCE_PIN');return `CON ${T[l].pin}`;}if(i==='5'){await save(s,{...d,state:'HISTORY_PAGE'},'HISTORY_PAGE');return history(u,s,'0',d,l,true);}if(i==='6'){await save(s,{...d,state:'AGENT_SERVICES'},'AGENT_SERVICES');return `CON ${l==='fr'?'Services\n1. TV\n2. Airtime\n3. Remboursement client\n4. Paramètres\n0. Retour':'Services\n1. TV\n2. Airtime\n3. Client repayment\n4. Settings\n0. Back'}`;}if(i==='7')return `END ${profile(u,l,true)}`;if(i==='8'){await save(s,{...d,state:'SETTINGS'},'SETTINGS');return settingsMenu(u,l);}return `CON ${T[l].invalid}\n${T[l].agent}`;}
async function agentMethod(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));if(!['1','2','3'].includes(i))return `CON ${T[l].invalid}`;if(i==='1'){await save(s,{...d,state:'AGENT_ID'},'AGENT_ID');return `CON ${T[l].id}`;}await save(s,{...d,state:'AGENT_ID',agentMethod:i==='2'?'card':'mobile_money'},'AGENT_ID');return `CON ${T[l].id}`;}
async function agentId(u:any,s:Session,i:string,d:any,l:Lang){const r=await getUssdRecipientInfo(i);if(!r.success)return `CON ${err(r.error,l)}\n${T[l].back}`;if(['disabled','suspended','blocked','inactive','banned'].includes(String(r.status||'').toLowerCase()))return `CON ${l==='fr'?'Client non disponible.':'Client is not available.'}`;await save(s,{...d,state:'AGENT_AMOUNT',client:i,clientInfo:r},'AGENT_AMOUNT');return `CON ${l==='fr'?`Client: ${r.firstName||'Client'}\nID Wallet: ${r.walletId}`:`Client: ${r.firstName||'Client'}\nWallet ID: ${r.walletId}`}\n${T[l].amount}`;}
async function agentAmount(u:any,s:Session,i:string,d:any,l:Lang){const a=Number(i);if(!Number.isFinite(a)||a<=0)return `CON ${T[l].invalidAmount}`;if(d.agentMethod==='mobile_money'){await save(s,{...d,state:'AGENT_MM_OPERATOR',amount:a},'AGENT_MM_OPERATOR');return `CON ${operatorMenu(l)}`;}if(d.agentMethod==='card'&&d.agentOp==='deposit'){const ref=`USSD-AGCARD-${Date.now()}-${u.id}`,x=await createMaxiCashGatewayLink(u,a,d.currency,ref,l,'card');await save(s,{...d,state:'MENU',amount:a,paymentReference:ref,paymentLink:x.link},'MENU');return x.success?`END ${l==='fr'?'Le lien de paiement a été envoyé au client. Veuillez vérifier son canal associé.':'The payment link has been sent to the client. Please check the customer’s associated channel.'}`:`END ${err(x.error||'',l)}`;}const feeCountry=d.agentOp==='withdraw'?String(d.clientInfo?.country||u.country):u.country;const type=d.agentOp==='withdraw'?'WD':'DP_AGENT',f=Number(await getUssdFee(a,d.currency,type,feeCountry));const total=a+f;await save(s,{...d,state:d.agentMethod==='mobile_money'?'AGENT_MM_CONFIRM':'AGENT_CONFIRM',amount:a,fee:f,totalDebit:total},d.agentMethod==='mobile_money'?'AGENT_MM_CONFIRM':'AGENT_CONFIRM');return d.agentOp==='withdraw'?`CON ${l==='fr'?`Retrait client\nMontant: ${a.toFixed(2)} ${d.currency}\nFrais: ${f.toFixed(2)} ${d.currency}\nTotal débité: ${total.toFixed(2)} ${d.currency}\n\nConfirmer la demande de retrait`:`Client withdrawal\nAmount: ${a.toFixed(2)} ${d.currency}\nFee: ${f.toFixed(2)} ${d.currency}\nTotal debited: ${total.toFixed(2)} ${d.currency}\n\nConfirm withdrawal request`}\n1. Confirmer\n0. Retour`:`CON ${a.toFixed(2)} ${d.currency}\n${l==='fr'?'Frais':'Fee'}: ${f.toFixed(2)} ${d.currency}\n${T[l].confirm}`;}
async function agentConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){if(i==='0')return back(u,s,d,l,c);if(i!=='1')return `CON ${T[l].invalid}`;if(d.agentOp==='withdraw'){await save(s,{...d,state:'AGENT_OTP_CHANNEL'},'AGENT_OTP_CHANNEL');return `CON ${l==='fr'?'Choisissez le canal pour recevoir l’OTP du client :\n1. SMS\n2. WhatsApp\n3. E-mail\n0. Retour':'Choose the channel to send the client OTP :\n1. SMS\n2. WhatsApp\n3. Email\n0. Back'}`;}await save(s,{...d,state:'AGENT_PIN'},'AGENT_PIN');return `CON ${T[l].pin}`;}
async function agentOtpChannel(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,'');const channel=i==='1'?'sms':i==='2'?'whatsapp':i==='3'?'email':null;if(!channel)return `CON ${T[l].invalid}`;const client=await getUssdRecipientInfo(d.client);if(!client.success)return `CON ${err(client.error||T[l].clientNotFound,l)}`;const clientId=Number(client.id||client.userId||client.user_id);if(!clientId)return `CON ${l==='fr'?'Client introuvable.':'Client not found.'}`;const amount=Number(d.amount||0),fee=Number(d.fee||0),total=amount+fee;const agentName=String(u.full_name||u.first_name||'Agent');const otpDescription=`retrait ${amount.toFixed(2)} ${d.currency} + frais ${fee.toFixed(2)} = ${total.toFixed(2)} par ${agentName}`;const otp=await sendAndStoreOtp(clientId,otpDescription,channel);if(!otp?.success){const detail=String(otp?.message||otp?.error||'').trim();return `CON ${l==='fr'?`Échec de l’envoi de l’OTP${detail?` : ${detail}`:''}.`:`OTP delivery failed${detail?`: ${detail}`:'.'}`}\n0. Retour`;}await save(s,{...d,state:'AGENT_WITHDRAW_OTP',otpChannel:channel},'AGENT_WITHDRAW_OTP');const channelLabel=channel==='sms'?'SMS':channel==='whatsapp'?'WhatsApp':'e-mail';return `CON ${l==='fr'?`OTP envoyé au client par ${channelLabel}.\nEntrez l’OTP reçu pour autoriser le retrait :`:`OTP sent to the client by ${channelLabel}.\nEnter the OTP received to authorize the withdrawal:`}`;}
async function agentMmOperator(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));const op=operatorCode(i);if(!op)return `CON ${T[l].invalid}`;const type=d.agentOp==='withdraw'?(({MPESA:'WD_MPESA',ORANGE:'WD_ORANGE_MONEY',AFRIMONEY:'WD_AFRIMONEY',AIRTEL:'WD_AIRTEL_MONEY',MTN:'WD_MTN_MOMO'} as any)[op]||'WD'):'DP_MM';const f=Number(await getUssdFee(d.amount,d.currency,type,u.country));await save(s,{...d,state:'AGENT_MM_CONFIRM',mmOperator:op,fee:f,feeType:type},'AGENT_MM_CONFIRM');return `CON ${d.amount.toFixed(2)} ${d.currency}\n${l==='fr'?'Frais':'Fee'}: ${f.toFixed(2)} ${d.currency}\n${T[l].confirm}`;}
async function agentMmConfirm(u:any,s:Session,i:string,d:any,l:Lang,c:any){if(i==='0')return back(u,s,d,l,c);if(i!=='1')return `CON ${T[l].invalid}`;await save(s,{...d,state:'AGENT_MM_PIN'},'AGENT_MM_PIN');return `CON ${T[l].pin}`;}
async function agentMmPin(u:any,s:Session,i:string,d:any,l:Lang){const ref=`USSD-AGMM-${Date.now()}-${u.id}`,x=await executeAgentMobileMoney(u,d.client,d.amount,d.currency,d.mmOperator||'AUTO',d.clientInfo?.phone||'',i,d.agentOp==='withdraw'?'payout':'collect',ref,d.feeType);await save(s,{...d,state:'MENU'},'MENU');return done(!!x.success,l,(x as any).reference||ref,err((x as any).error||'',l));}
async function agentPin(u:any,s:Session,i:string,d:any,l:Lang){
  const beforeComm=d.agentOp==='withdraw'?Number((await getCommissionStats(u.id,d.currency)).available||0):0;
  const x=d.agentOp==='withdraw'?await executeAgentWithdraw(u,d.client,d.amount,d.currency,i):await executeAgentDeposit(u,d.client,d.amount,d.currency,i);
  if(x?.success&&d.agentOp==='withdraw'){
    const clientInfo=d.clientInfo?.id||d.clientInfo?.userId||d.clientInfo?.user_id?d.clientInfo:await getUssdRecipientInfo(d.client);
    const clientPhone=String(clientInfo?.phone||'').trim();
    const clientId=clientInfo?.id||clientInfo?.userId||clientInfo?.user_id;
    const clientBalance=Number(await getUssdBalance(clientId,d.currency));
    const wallet=String(clientInfo?.walletId||clientInfo?.id_wallet||d.client||'');
    const agentName=String(u?.first_name||u?.full_name||u?.name||'Agent');
    const amount=Number(d.amount||0),fee=Number(d.fee||0),total=amount+fee;
    if(clientPhone){
      const message=l==='fr'
        ? `CashPay\nRetrait de ${amount.toFixed(2)} ${d.currency} — ${agentName} (${wallet})\nAgent : ${agentName} | Débité : ${total.toFixed(2)} ${d.currency} | Frais : ${fee.toFixed(2)} ${d.currency}\nRéf : ${String((x as any).reference||'N/D')} | Solde : ${clientBalance.toFixed(2)} ${d.currency}`
        : `CashPay\nWithdrawal ${amount.toFixed(2)} ${d.currency} — ${agentName} (${wallet})\nAgent: ${agentName} | Debited: ${total.toFixed(2)} ${d.currency} | Fee: ${fee.toFixed(2)} ${d.currency}\nRef: ${String((x as any).reference||'N/A')} | Balance: ${clientBalance.toFixed(2)} ${d.currency}`;
      await sendSms(clientPhone,message).catch(()=>null);
    }
    const afterComm=Number((await getCommissionStats(u.id,d.currency)).available||0);
    const commission=Number.isFinite(Number((x as any).commission))?Number((x as any).commission):Math.max(0,afterComm-beforeComm);
    const agentBalance=Number(await getUssdBalance(u.id,d.currency));
    const agentMessage=l==='fr'
      ? `CashPay\nReçu : ${amount.toFixed(2)} ${d.currency} | Commission : ${commission.toFixed(2)} ${d.currency}\nSolde : ${agentBalance.toFixed(2)} ${d.currency} | Réf : ${String((x as any).reference||'N/D')}`
      : `CashPay\nReceived: ${amount.toFixed(2)} ${d.currency} | Commission: ${commission.toFixed(2)} ${d.currency}\nBalance: ${agentBalance.toFixed(2)} ${d.currency} | Ref: ${String((x as any).reference||'N/A')}`;
    await sendSms(String(u.phone||''),agentMessage).catch(()=>null);
  }
  await save(s,{...d,state:'MENU'},'MENU');
  return done(!!x.success,l,(x as any).reference,err((x as any).error||'',l));
}
async function agentBalancePin(u:any,s:Session,i:string,d:any,l:Lang){const p=await verifyUserPin(u.id,String(i||''));if(!p.success)return `CON ${l==='fr'?'Code PIN incorrect.':'Incorrect PIN.'}`;const b=await getUssdBalance(u.id,d.currency);await save(s,{...d,state:'MENU'},'MENU');return `END ${l==='fr'?`Mon solde : ${b.toFixed(2)} ${d.currency}`:`My balance: ${b.toFixed(2)} ${d.currency}`}`;}
async function agentCommViewPin(u:any,s:Session,i:string,d:any,l:Lang){const p=await verifyUserPin(u.id,String(i||''));if(!p.success)return `CON ${l==='fr'?'Code PIN incorrect.':'Incorrect PIN.'}`;const st=await getCommissionStats(u.id,d.currency);await save(s,{...d,state:'COMM_MENU',comm:st},'COMM_MENU');return `CON ${l==='fr'?'Commissions':'Commissions'}\n${l==='fr'?'Disponible':'Available'}: ${Number(st.available||0).toFixed(2)} ${d.currency}\n${l==='fr'?'Aujourd’hui':'Today'}: ${Number(st.daily||0).toFixed(2)} ${d.currency}\n1. ${l==='fr'?'Basculer vers le compte principal':'Move to main account'}\n${T[l].back}`;}
async function commMenu(u:any,s:Session,i:string,d:any,l:Lang){if(i==='0')return back(u,s,d,l,await getCountryByPhone(u.phone));if(i!=='1')return `CON ${T[l].invalid}`;if(Number(d.comm?.available||0)<=0)return `END ${l==='fr'?'Aucune commission disponible.':'No commission available.'}`;await save(s,{...d,state:'COMM_AMOUNT'},'COMM_AMOUNT');return `CON ${T[l].amount}`;}
async function commAmount(u:any,s:Session,i:string,d:any,l:Lang){const a=Number(i),max=Number(d.comm?.available||0);if(!Number.isFinite(a)||a<=0||a>max)return `CON ${l==='fr'?'Montant invalide ou supérieur aux commissions disponibles.':'Invalid amount or greater than available commissions.'}`;await save(s,{...d,state:'COMM_PIN',amount:a},'COMM_PIN');return `CON ${T[l].pin}`;}
async function commPin(u:any,s:Session,i:string,d:any,l:Lang){const x=await executeCommissionClaim(u,d.amount,d.currency,i);await save(s,{...d,state:'MENU'},'MENU');return done(!!x.success,l,(x as any).reference,err((x as any).error||'',l));}
async function agentServices(u:any,s:Session,i:string,d:any,l:Lang){
  if(i==='0')return agentMenu(u,s,'6',d,l,await getCountryByPhone(u.phone));
  if(i==='1'){
    await save(s,{...d,state:'TV_OPERATOR'},'TV_OPERATOR');
    return `CON ${T[l].tv}`;
  }
  if(i==='2'){
    return `CON ${l==='fr'?'Airtime : service de paiement disponible prochainement.\n0. Retour':'Airtime: payment service available soon.\n0. Back'}`;
  }
  if(i==='3'){
    await save(s,{...d,state:'AGENT_REPAYMENT'},'AGENT_REPAYMENT');
    return `CON ${l==='fr'?'Remboursement client\n1. Remboursement LoanMe\n0. Retour':'Client repayment\n1. LoanMe repayment\n0. Back'}`;
  }
  if(i==='4'){
    await save(s,{...d,state:'SETTINGS'},'SETTINGS');
    return settingsMenu(u,l);
  }
  return `CON ${T[l].invalid}\n${l==='fr'?'Services\n1. TV\n2. Airtime\n3. Remboursement client\n4. Paramètres\n0. Retour':'Services\n1. TV\n2. Airtime\n3. Client repayment\n4. Settings\n0. Back'}`;
}

export const handleUssd=handleUssdRequest;
export default handleUssdRequest;
