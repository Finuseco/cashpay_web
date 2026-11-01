import { INTER_REJECTION_REASONS } from '@/lib/inter-claim-reasons';
import { db } from '@/lib/db';
import type { PoolClient } from 'pg';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { requireSuperAgent, countryIdentity } from '@/lib/super-agent-access';
import { countries } from '@/lib/countries';
import { countryToCode, generateReferenceCode } from '@/lib/utils';
import * as bcrypt from 'bcryptjs';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { sendWhatsAppTextMessage } from '@/services/whatsapp';

function aliases(value:string) {const code=countryToCode(value);return [...new Set([value,code,countries.find(row=>row.code===code)?.name].filter(Boolean).map(v=>String(v).trim().toLowerCase()))];}
async function actor(connection?: PoolClient, identity?: Awaited<ReturnType<typeof getAuthenticatedUser>>) {
 const authenticated = identity || (!connection ? await getAuthenticatedUser() : null);
 const fresh = connection && authenticated ? (await connection.query("SELECT id,role,country,province,status,full_name,id_wallet FROM users WHERE id=$1 AND LOWER(status)='active'",[authenticated.id])).rows[0] : null;
 const user = connection ? (fresh && {...authenticated,...fresh}) : authenticated;
 if (!user || String(user.status).toLowerCase()!=='active') throw new Error('Compte actif et authentification requis.');
 const { rows } = await (connection || db).query('SELECT * FROM inter_agent_memberships WHERE user_id = $1 AND active = TRUE', [user.id]);
 if (rows[0] && countryIdentity(rows[0].country)!==countryIdentity(user.country || '')) throw new Error('Juridiction modifiée : une nouvelle nomination est nécessaire.');
 const manager = ['Admin','SuperAgent'].includes(user.role);
 if (!manager && !rows[0]) throw new Error('Nomination agent inter requise.');
 return { user, membership: rows[0], manager, supervisor: manager || rows[0]?.kind === 'supervisor' };
}
async function pin(connection: PoolClient, userId: number, value: string) {
 if (!/^\d{4}$/.test(value)) throw new Error('PIN à quatre chiffres requis.');
 const attempts=await connection.query("SELECT COUNT(*)::int AS total FROM inter_claim_audit WHERE actor_user_id=$1 AND action='PIN_REJECTED' AND created_at>NOW()-INTERVAL '15 minutes'",[userId]);
 if(attempts.rows[0].total>=5)throw new Error('Trop de tentatives PIN. Réessayez dans 15 minutes.');
 const { rows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1', [userId]);
 if (!rows[0]?.pin_hash || !await bcrypt.compare(value,rows[0].pin_hash)) throw new InterPinFailure(userId);
}
function territory(a: Awaited<ReturnType<typeof actor>>, country: string, province?:string) {
 if (provinceScope(a) && String(provinceScope(a)).trim().toLowerCase()!==String(province || '').trim().toLowerCase()) throw new Error('Réclamation hors de votre province.');
 if (a.user.role !== 'Admin' && (!a.user.country || countryIdentity(a.user.country) !== countryIdentity(country))) throw new Error('Réclamation hors de votre pays.');
}
function provinceScope(a: Awaited<ReturnType<typeof actor>>) {
 if (a.user.role==='Admin') return null;
 if (a.user.role==='SubSuperAgent') return a.user.province || '__UNASSIGNED__';
 return a.membership?.kind==='agent' ? (a.membership.province || '__UNASSIGNED__') : null;
}
async function audit(c: PoolClient, claimId: number | null, userId: number, action: string, detail: object = {}) {
 await c.query(`INSERT INTO inter_claim_audit(claim_id,actor_user_id,action,detail) SELECT $1,$2,$3,$4::jsonb || jsonb_build_object('actorName',u.full_name,'actorWalletId',u.id_wallet) FROM users u WHERE u.id=$2`,[claimId,userId,action,JSON.stringify(detail)]);
}
async function signal(c: PoolClient, claimId: number, userId: number, title: string, supervisorId?: number, actorId?: number) {
 const owner=(await c.query('SELECT country FROM users WHERE id=$1',[userId])).rows[0];
 const { rows } = await c.query(`SELECT DISTINCT u.id,u.role FROM users u JOIN users owner ON owner.id = $1
 WHERE u.id = $1 OR u.id = $2 OR (u.role IN ('Admin','SuperAgent') AND (u.role = 'Admin' OR LOWER(TRIM(u.country))=ANY($3::text[])))`, [userId,supervisorId || null,aliases(owner?.country || '')]);
 const person=actorId ? (await c.query('SELECT full_name FROM users WHERE id=$1',[actorId])).rows[0]?.full_name : null;
 for (const target of rows) {
  await c.query("INSERT INTO notifications(user_id,title,description,type,link,is_read) VALUES($1,$2,$3,'general',$4,FALSE)",[target.id,title,`Réclamation #${claimId}${person ? ` — ${person}` : ''}. Consultez le journal de traitement.`,Number(target.id) === Number(userId) ? '/receive' : ['Admin','SuperAgent'].includes(target.role) ? '/super-agent/inter-agents' : '/inter-agent']);
  await c.query("SELECT pg_notify('inter_claim_activity',$1)",[JSON.stringify({userId:target.id,claimId})]);
 }
}
export async function appointInterAgent(input: { walletId: string; agency: string; kind: 'agent'|'supervisor'; supervisorWalletId?: string; pin: string; active: boolean; province?: string }) {
 const identity=await getAuthenticatedUser();
 if(!identity)throw new Error('Authentification requise.');
 const admin=await requireSuperAgent();
 const c=await db.getConnection();
 try {
  await c.query('BEGIN');

  if (!['Admin','SuperAgent'].includes(admin.role)) throw new Error('Nomination réservée au Super Agent national.');
  await pin(c,admin.id,input.pin);
  if (typeof input.active!=='boolean') throw new Error('Le statut de nomination doit être explicite.');
  if (!input.agency?.trim() || !['agent','supervisor'].includes(input.kind)) throw new Error('Agence et fonction requises.');
  const { rows }=await c.query('SELECT id,country,province,role FROM users WHERE id_wallet = $1 FOR UPDATE',[input.walletId.trim().toUpperCase()]);
  if (!rows[0]) throw new Error('Portefeuille introuvable.');
  if(admin.role!=='Admin' && (countryIdentity(admin.country)!==countryIdentity(rows[0].country || '') || ['Admin','SuperAgent'].includes(rows[0].role))) throw new Error('Ce compte ne relève pas de votre juridiction.');
  const assignedProvince=input.kind==='agent' ? String(input.province || rows[0].province || '').trim() : null;
  if(input.kind==='agent' && !assignedProvince)throw new Error('Province d’affectation obligatoire pour un agent inter.');
  let supervisorId: number|null=null;
  if (input.supervisorWalletId?.trim()) {
   const { rows: supervisors }=await c.query("SELECT u.id,u.country FROM users u JOIN inter_agent_memberships m ON m.user_id=u.id WHERE u.id_wallet=$1 AND m.active=TRUE AND m.kind='supervisor'",[input.supervisorWalletId.trim().toUpperCase()]);
   if (!supervisors[0] || countryIdentity(supervisors[0].country)!==countryIdentity(rows[0].country) || supervisors[0].id===rows[0].id) throw new Error('Superviseur inter actif du même pays requis.');
   supervisorId=supervisors[0].id;
  }
  {
   const current=await c.query('SELECT * FROM inter_agent_memberships WHERE user_id=$1 FOR UPDATE',[rows[0].id]);
   const held=await c.query("SELECT 1 FROM inter_claim_cases WHERE agent_user_id=$1 AND status IN ('reserved','disputed') LIMIT 1",[rows[0].id]);
   if(held.rows.length && input.kind==='agent'){const outside=await c.query("SELECT 1 FROM inter_claim_cases ic JOIN international_transfer_claims cl ON cl.id=ic.claim_id JOIN users u ON u.id=cl.user_id WHERE ic.agent_user_id=$1 AND ic.status IN ('reserved','disputed') AND LOWER(TRIM(COALESCE(u.province,'')))<>LOWER(TRIM($2)) LIMIT 1",[rows[0].id,assignedProvince]);if(outside.rows.length)throw new Error('Des dossiers réservés sont hors de cette province. Intervention nationale requise.');}
   if (held.rows.length && (!input.active || (current.rows[0] && ((current.rows[0].province && current.rows[0].province!==assignedProvince) || current.rows[0].kind!==input.kind || current.rows[0].agency_name!==input.agency.trim() || Number(current.rows[0].supervisor_user_id || 0)!==Number(supervisorId || 0))))) throw new Error('Les dossiers réservés ou en litige doivent être résolus avant changement de fonction, agence, superviseur ou désactivation.');
  }
  await c.query(`INSERT INTO inter_agent_memberships(user_id,supervisor_user_id,agency_name,country,kind,appointed_by,active,province) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
   ON CONFLICT(user_id) DO UPDATE SET supervisor_user_id=EXCLUDED.supervisor_user_id,agency_name=EXCLUDED.agency_name,province=EXCLUDED.province,country=EXCLUDED.country,kind=EXCLUDED.kind,active=EXCLUDED.active,updated_at=NOW()`,[rows[0].id,supervisorId,input.agency.trim().slice(0,160),rows[0].country,input.kind,admin.id,Boolean(input.active),assignedProvince]);
  await c.query("INSERT INTO notifications(user_id,title,description,type,link,is_read) VALUES($1,'Nomination agent inter',$2,'general','/inter-agent',FALSE)",[rows[0].id,`${input.agency.trim()} : ${input.kind}, ${input.active?'actif':'désactivé'}.`]);
  await audit(c,null,admin.id,'APPOINTMENT',{userId:rows[0].id,agency:input.agency,kind:input.kind,active:input.active,province:assignedProvince});
  await c.query('COMMIT'); return { success:true };
 } catch(e) { await rollback(c,e); throw e; } finally { c.release(); }
}
export async function interDashboard(page = 0) {
 const a=await actor();
 const code=countryIdentity(a.user.country || '');
 // No name, phone, tracking number or document is exposed by the queue.
 const { rows: claims }=await db.query(`SELECT cl.id,cl.provider,cl.expected_amount,cl.expected_currency,cl.receive_in_currency,cl.status,cl.created_at,
   ic.agent_user_id,ic.status AS processing_status,ic.net_amount,ic.currency,ic.disclosed_at
   FROM international_transfer_claims cl JOIN users u ON u.id=cl.user_id LEFT JOIN inter_claim_cases ic ON ic.claim_id=cl.id
   WHERE ($1::boolean OR LOWER(TRIM(u.country))=ANY($2::text[]))
   AND ($6::text IS NULL OR LOWER(TRIM(u.province))=LOWER(TRIM($6)))
   AND ($3::boolean OR cl.provider=ANY($4::text[]))
   AND ($3::boolean OR ic.agent_user_id=$5 OR ic.agent_user_id IS NULL)
   AND (cl.status IN ('pending','approved') OR ic.claim_id IS NOT NULL)
   ORDER BY CASE WHEN ic.status IN ('reserved','disputed') THEN 0 WHEN cl.status IN ('pending','approved') AND ic.claim_id IS NULL THEN 1 ELSE 2 END, cl.created_at ASC,cl.id ASC LIMIT 201 OFFSET $7`,[a.user.role==='Admin',aliases(a.user.country || ''),a.supervisor,a.membership?.providers || [],a.user.id,provinceScope(a),Math.min(10000,Math.max(0,Math.floor(Number(page)||0)))*200]);
 const { rows: members }=a.supervisor ? await db.query(`SELECT m.*,u.full_name,u.id_wallet FROM inter_agent_memberships m JOIN users u ON u.id=m.user_id
  WHERE ($1::boolean OR LOWER(TRIM(u.country))=ANY($2::text[])) AND ($5::text IS NULL OR LOWER(TRIM(m.province))=LOWER(TRIM($5))) AND ($3::boolean OR m.supervisor_user_id=$4 OR m.user_id=$4) ORDER BY u.full_name`,[a.user.role==='Admin',aliases(a.user.country || ''),a.supervisor,a.user.id,provinceScope(a)]) : {rows:[]};
 const { rows: history }=await db.query(`SELECT e.id,e.claim_id,e.action,e.detail,e.created_at,u.full_name AS actor_name,
  ic.net_amount,ic.currency,ic.status AS processing_status
  FROM inter_claim_audit e JOIN users u ON u.id=e.actor_user_id LEFT JOIN inter_claim_cases ic ON ic.claim_id=e.claim_id
  WHERE ($1::boolean OR LOWER(TRIM(u.country))=ANY($2::text[]))
  AND ($5::text IS NULL OR e.actor_user_id=$4 OR LOWER(TRIM(u.province))=LOWER(TRIM($5))) AND ($3::boolean OR e.actor_user_id=$4 OR ic.supervisor_user_id=$4)
  ORDER BY e.id DESC LIMIT 100`,[a.user.role==='Admin',aliases(a.user.country || ''),a.supervisor,a.user.id,provinceScope(a)]);
 const { rows: balances }=await db.query('SELECT balances FROM wallets WHERE user_id=$1',[a.user.id]);
 const {rows:totals}=await db.query(`SELECT ic.currency,ic.status,COUNT(*)::int AS count,SUM(ic.net_amount)::text AS amount,SUM(ic.fee_amount)::text AS external_commission FROM inter_claim_cases ic JOIN international_transfer_claims cl ON cl.id=ic.claim_id JOIN users u ON u.id=cl.user_id WHERE ($1::boolean OR LOWER(TRIM(u.country))=ANY($2::text[])) AND ($5::text IS NULL OR LOWER(TRIM(u.province))=LOWER(TRIM($5))) AND ($3::boolean OR ic.agent_user_id=$4 OR ic.supervisor_user_id=$4) GROUP BY ic.currency,ic.status ORDER BY ic.currency,ic.status`,[a.user.role==='Admin',aliases(a.user.country || ''),a.supervisor,a.user.id,provinceScope(a)]);
 return {success:true,totals,userId:a.user.id,canAppoint:a.manager,supervisor:a.supervisor,membership:a.membership || null,claims:claims.slice(0,200),hasMore:claims.length>200,members,history,balances:balances[0]?.balances || {}};
}
export async function revealInterClaim(id:number, suppliedPin:string, authorization?:{maxNet:string;currency:string}) {
 const identity=await getAuthenticatedUser();
 if(!identity)throw new Error('Authentification requise.');
 const c=await db.getConnection();
 try {
  await c.query('BEGIN'); const a=await actor(c,identity);
  if (!a.membership || !['agent','supervisor'].includes(a.membership.kind)) throw new Error('Un agent inter actif doit prendre en charge le dossier.');
  await pin(c,a.user.id,suppliedPin);
  const {rows}=await c.query('SELECT cl.*,u.country,u.province,u.full_name,u.first_name,u.last_name,u.id_wallet,d.id_type,d.id_number FROM international_transfer_claims cl JOIN users u ON u.id=cl.user_id LEFT JOIN user_documents d ON d.id=cl.user_document_id AND d.user_id=cl.user_id WHERE cl.id=$1 FOR UPDATE OF cl',[id]);
  const claim=rows[0]; if (!claim) throw new Error('Réclamation introuvable.'); territory(a,claim.country,claim.province);
  if (Number(claim.user_id)===Number(a.user.id) || !a.membership.providers.includes(claim.provider)) throw new Error('Traitement non autorisé.');
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`inter:${claim.provider}:${String(claim.tracking_number).trim().toUpperCase()}`]);
  const previous=await c.query('SELECT * FROM inter_claim_cases WHERE claim_id=$1',[id]);
  if (previous.rows[0]) {
   if (Number(previous.rows[0].agent_user_id)!==Number(a.user.id)) throw new Error('Dossier déjà pris en charge.');
   await audit(c,id,a.user.id,'REVIEW');
   const detailed=await identityDetail(c,claim);await c.query('COMMIT'); return {success:true,claim:detailed,processing:previous.rows[0]};
  }
  if (!['pending','approved'].includes(claim.status)) throw new Error('Dossier déjà clos.');
  const duplicate=await c.query(`SELECT 1 FROM inter_claim_cases ic JOIN international_transfer_claims cl ON cl.id=ic.claim_id
   WHERE cl.provider=$1 AND UPPER(TRIM(cl.tracking_number))=UPPER(TRIM($2)) AND ic.status<>'rejected' LIMIT 1`,[claim.provider,claim.tracking_number]);
  if (duplicate.rows.length) throw new Error('Cette référence est déjà réservée, réglée ou en litige.');
  const {gross,net,rate,currency}=await pricing(c,claim,a.membership);
  if (String(authorization?.currency)!==currency || !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(String(authorization?.maxNet))) throw new Error('Confirmez le devis avant de réserver.');
  const consent=await c.query('SELECT $1::numeric <= $2::numeric AS valid',[net,String(authorization.maxNet)]);
  if (!consent.rows[0].valid) throw new Error('Le taux a changé. Actualisez et confirmez le nouveau devis.');
  const wallet=await c.query('SELECT balances FROM wallets WHERE user_id=$1 FOR UPDATE',[a.user.id]);
  if (!wallet.rows.length) throw new Error('Portefeuille agent introuvable.');
  const held=await c.query(`UPDATE wallets SET balances=jsonb_set(COALESCE(balances,'{}'::jsonb),ARRAY[$2::text],to_jsonb(COALESCE((balances->>$2)::numeric,0)-$3::numeric))
    WHERE user_id=$1 AND COALESCE((balances->>$2)::numeric,0)>=$3::numeric RETURNING user_id`,[a.user.id,currency,net]);
  if (!held.rows.length) throw new Error(`Veuillez approvisionner votre compte : ${net} ${currency} disponibles sont nécessaires avant de dévoiler les données.`);
  const tx=await c.query(`INSERT INTO transactions(reference_code,type_code,status,amount,currency,fee,description,sender_id,receiver_id,sender_wallet_id,receiver_wallet_id,metadata)
   VALUES($1,'INTL_AGENT_HOLD','Pending',$2,$3,0,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id`,[generateReferenceCode('INTER'),net,currency,`Réservation réclamation #${id}`,a.user.id,claim.user_id,a.user.id_wallet,claim.id_wallet,JSON.stringify({claimId:id,externalGross:gross,externalCommissionPercent:a.membership.fee_percent})]);
  const created=await c.query(`INSERT INTO inter_claim_cases(claim_id,agent_user_id,supervisor_user_id,status,currency,gross_amount,net_amount,fee_amount,fee_percent,exchange_rate,hold_transaction_id)
   VALUES($1,$2,$3,'reserved',$4,$5,$6,$5::numeric-$6::numeric,$7,$8,$9) RETURNING *`,[id,a.user.id,a.membership.supervisor_user_id,currency,gross,net,a.membership.fee_percent,rate,tx.rows[0].id]);
  await audit(c,id,a.user.id,'DISCLOSED_AND_RESERVED',{amount:net,currency,agency:a.membership.agency_name});
  await signal(c,id,claim.user_id,'Un agent inter a consulté votre réclamation',a.membership.supervisor_user_id,a.user.id);
  const detailed=await identityDetail(c,claim);await c.query('COMMIT'); return {success:true,claim:detailed,processing:created.rows[0]};
 } catch(e) {await rollback(c,e);throw e;} finally {c.release();}
}
export async function resolveInterClaim(input:{id:number;action:'pay'|'reject';pin:string;receipt?:string;reason?:string;collected:boolean;reasonCode?:string;verification?:{identity:boolean;document:boolean;signature:boolean;tracking:boolean;beneficiaryName:string}}) {
 const identity=await getAuthenticatedUser();
 if(!identity)throw new Error('Authentification requise.');
 const c=await db.getConnection(); let receipt:any;
 try {
  await c.query('BEGIN'); const a=await actor(c,identity); await pin(c,a.user.id,input.pin);
  const {rows}=await c.query(`SELECT ic.*,cl.user_id,cl.provider,cl.tracking_number,u.country,u.province FROM inter_claim_cases ic JOIN international_transfer_claims cl ON cl.id=ic.claim_id JOIN users u ON u.id=cl.user_id WHERE ic.claim_id=$1 FOR UPDATE OF ic,cl`,[input.id]);
  const item=rows[0]; if (!item || Number(item.agent_user_id)!==Number(a.user.id)) throw new Error('Dossier réservé par un autre agent.'); territory(a,item.country,item.province);
  if (item.status==='paid' && input.action==='pay') { await c.query('COMMIT');return {success:true,status:'paid',alreadyProcessed:true}; }
  if (!['reserved','disputed'].includes(item.status)) throw new Error('Dossier déjà traité.');
  const original=await c.query("SELECT id FROM transactions WHERE id=$1 AND sender_id=$2 AND receiver_id=$3 AND status='Pending' AND type_code='INTL_AGENT_HOLD' AND amount=$4 AND currency=$5 FOR UPDATE",[item.hold_transaction_id,a.user.id,item.user_id,item.net_amount,item.currency]);
  if(!original.rows.length)throw new Error('La réservation comptable ne correspond plus au dossier. Intervention du superviseur requise.');
  const locks=await c.query('SELECT user_id FROM wallets WHERE user_id=ANY($1::int[]) ORDER BY user_id FOR UPDATE',[[a.user.id,item.user_id]]);
  if (locks.rows.length!==2) throw new Error('Portefeuille client ou agent introuvable.');
  if (input.action==='pay') {
   const verified=await identityDetail(c,{id:item.claim_id,user_id:item.user_id});
   if(!verified.identityReady || !input.verification || !['identity','document','signature','tracking'].every(key=>input.verification?.[key as 'identity']===true) || !input.verification.beneficiaryName?.trim()) throw new Error('Vérifiez la pièce, la signature et le bénéficiaire du transfert avant paiement.');
   const normalize=(name:string)=>name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
   if(normalize(input.verification.beneficiaryName)!==normalize(verified.full_name || ''))throw new Error('Le nom du bénéficiaire vérifié doit correspondre au nom complet du compte.');
   await audit(c,item.claim_id,a.user.id,'IDENTITY_VERIFIED',{documentId:verified.user_document_id,beneficiaryName:input.verification.beneficiaryName.trim(),checks:input.verification});
   if (input.collected!==true || !input.receipt?.trim() || input.receipt.trim().length<4) throw new Error('Confirmez la réception externe et sa référence justificative.');
   await c.query(`UPDATE wallets SET balances=jsonb_set(COALESCE(balances,'{}'::jsonb),ARRAY[$2::text],to_jsonb(COALESCE((balances->>$2)::numeric,0)+$3::numeric)) WHERE user_id=$1`,[item.user_id,item.currency,item.net_amount]);
   await c.query("UPDATE transactions SET status='Completed',description=$2,metadata=metadata || $3::jsonb WHERE id=$1 AND status='Pending'",[item.hold_transaction_id,`Règlement ${item.provider} #${item.claim_id}`,JSON.stringify({externalReceipt:input.receipt.trim(),externalCommission:item.fee_amount})]);
   await c.query("UPDATE inter_claim_cases SET status='paid',funds_collected=TRUE,receipt_reference=$2,resolved_at=NOW() WHERE claim_id=$1",[item.claim_id,input.receipt.trim().slice(0,200)]);
   await c.query("UPDATE international_transfer_claims SET status='completed',updated_at=NOW() WHERE id=$1",[item.claim_id]);
   await audit(c,item.claim_id,a.user.id,'PAID',{net:item.net_amount,currency:item.currency,commission:item.fee_amount,receipt:input.receipt.trim()});
   await signal(c,item.claim_id,item.user_id,'Votre réclamation a été créditée',item.supervisor_user_id,a.user.id);
   const client=await c.query('SELECT phone,email,full_name FROM users WHERE id=$1',[item.user_id]);
   receipt={...client.rows[0],amount:item.net_amount,currency:item.currency,claimId:item.claim_id,actorId:a.user.id,agentName:a.user.full_name,feePercent:item.fee_percent};
  } else if (input.action==='reject') {
   if (!input.reason || input.reason.trim().length<10) throw new Error('Motif détaillé de rejet requis (10 caractères minimum).');
   if(!input.reasonCode || !Object.prototype.hasOwnProperty.call(INTER_REJECTION_REASONS,input.reasonCode))throw new Error('Choisissez un motif de rejet reconnu.');
   const rejection=INTER_REJECTION_REASONS[input.reasonCode as keyof typeof INTER_REJECTION_REASONS];
   const explanation=`${rejection.label}. ${input.reason.trim().slice(0,1200)}\n${rejection.guidance}`;
   const disputed=input.collected || item.funds_collected || item.status==='disputed';
   if (!disputed) {
    await c.query(`UPDATE wallets SET balances=jsonb_set(COALESCE(balances,'{}'::jsonb),ARRAY[$2::text],to_jsonb(COALESCE((balances->>$2)::numeric,0)+$3::numeric)) WHERE user_id=$1`,[a.user.id,item.currency,item.net_amount]);
    await c.query("UPDATE transactions SET status='Reversed' WHERE id=$1",[item.hold_transaction_id]);
    await c.query("UPDATE international_transfer_claims SET status='rejected',updated_at=NOW() WHERE id=$1",[item.claim_id]);
   }
   await c.query('UPDATE inter_claim_cases SET status=$2,rejection_reason=$3,funds_collected=$4,resolved_at=NOW() WHERE claim_id=$1',[item.claim_id,disputed?'disputed':'rejected',explanation,disputed]);
   await audit(c,item.claim_id,a.user.id,disputed?'DISPUTED_FUNDS_HELD':'REJECTED_AND_RELEASED',{reason:explanation,reasonCode:input.reasonCode});
   await signal(c,item.claim_id,item.user_id,disputed?'Réclamation en litige — fonds réservés':'Réclamation rejetée',item.supervisor_user_id,a.user.id);
   await c.query("INSERT INTO notifications(user_id,title,description,type,link,is_read) VALUES($1,$2,$3,'general',$4,FALSE)",[item.user_id,`Réclamation #${item.claim_id} : ${rejection.label}`,explanation,'/receive']);
   const client=(await c.query('SELECT phone,email,full_name FROM users WHERE id=$1',[item.user_id])).rows[0];
   receipt={...client,claimId:item.claim_id,actorId:a.user.id,rejection:explanation,disputed};
  } else throw new Error('Action invalide.');
  await c.query('COMMIT');
 } catch(e) {await rollback(c,e);throw e;} finally {c.release();}
 if (receipt) {
  const message=receipt.rejection ? `CashPay : réclamation #${receipt.claimId} ${receipt.disputed?'en litige':'rejetée'}. ${receipt.rejection}` : `CashPay : votre réclamation #${receipt.claimId} a été créditée de ${receipt.amount} ${receipt.currency}, après déduction de ${receipt.feePercent} % de frais d’agence. Agent : ${receipt.agentName}.`;
  const deliveries=await Promise.allSettled([
   ...(receipt.phone ? [sendSms(receipt.phone,message),sendWhatsAppTextMessage(receipt.phone,message)] : []),
   ...(receipt.email ? [sendEmail(receipt.email,receipt.rejection?'Réclamation : motif de traitement':'Réclamation créditée','general',{title:receipt.rejection?'Motif et consignes':'Crédit confirmé',greeting:`Bonjour ${receipt.full_name}`,message:message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')})] : [])
  ]);
  await db.query("INSERT INTO inter_claim_audit(claim_id,actor_user_id,action,detail) VALUES($1,$2,'DELIVERY',$3::jsonb)",[receipt.claimId,receipt.actorId,JSON.stringify({accepted:deliveries.filter(r=>r.status==='fulfilled'&&r.value.success).length,attempted:deliveries.length})]).catch(error=>console.error('[Inter receipt audit]',error.code));
 }
 return {success:true};
}

export async function inspectInterClaim(id:number,suppliedPin:string) {
 const identity=await getAuthenticatedUser();
 if(!identity)throw new Error('Authentification requise.');
 const c=await db.getConnection();
 try {
  await c.query('BEGIN');const a=await actor(c,identity);
  if(!a.supervisor)throw new Error('Supervision inter requise.');await pin(c,a.user.id,suppliedPin);
  const processing=(await c.query('SELECT * FROM inter_claim_cases WHERE claim_id=$1',[id])).rows[0];
  if(!processing)throw new Error('Les données restent masquées tant qu’un agent ne réserve pas le dossier.');
  if(!a.supervisor&&Number(processing.supervisor_user_id)!==Number(a.user.id))throw new Error('Cette agence ne relève pas de votre supervision.');
  const claim=(await c.query('SELECT cl.*,u.country,u.province,u.full_name,u.first_name,u.last_name,u.id_wallet,d.id_type,d.id_number FROM international_transfer_claims cl JOIN users u ON u.id=cl.user_id LEFT JOIN user_documents d ON d.id=cl.user_document_id AND d.user_id=cl.user_id WHERE cl.id=$1',[id])).rows[0];
  if(!claim)throw new Error('Réclamation introuvable.');territory(a,claim.country,claim.province);
  await audit(c,id,a.user.id,'SUPERVISOR_REVIEW');
  await signal(c,id,claim.user_id,'Votre dossier a été contrôlé par un superviseur',processing.supervisor_user_id,a.user.id);
  const detailed=await identityDetail(c,claim);await c.query('COMMIT');return {success:true,claim:detailed,processing,inspection:true};
 }catch(e){await rollback(c,e);throw e;}finally{c.release();}
}

async function pricing(c:PoolClient,claim:any,membership:any) {
 const currency=String(claim.receive_in_currency).toUpperCase();
  if (!['USD','EUR','CDF'].includes(currency)) throw new Error('Devise non prise en charge.');
  let rate='1';
  if (claim.expected_currency!==currency) {
   const fx=await c.query('SELECT rate FROM exchange_rates WHERE country_code=$1 AND from_currency=$2 AND to_currency=$3',[countryToCode(claim.country),claim.expected_currency,currency]);
   if (!fx.rows[0] || Number(fx.rows[0].rate)<=0) throw new Error('Taux de change local indisponible.'); rate=String(fx.rows[0].rate);
  }
  const amounts=await c.query(`SELECT ROUND($1::numeric*$2::numeric,2)::text AS gross,ROUND($1::numeric*$2::numeric*(1-$3::numeric/100),2)::text AS net`,[claim.expected_amount,rate,membership.fee_percent]);
  const {gross,net}=amounts.rows[0]; if (Number(net)<=0) throw new Error('Montant net invalide.');
  return {gross,net,rate,currency};

}

export async function quoteInterClaim(id:number) {
 const identity=await getAuthenticatedUser();
 if(!identity)throw new Error('Authentification requise.');
 const c=await db.getConnection();
 try {
  const a=await actor(c,identity);if(!a.membership||!['agent','supervisor'].includes(a.membership.kind))throw new Error('Agent inter actif requis.');
  const claim=(await c.query('SELECT cl.id,cl.user_id,cl.provider,cl.expected_amount,cl.expected_currency,cl.receive_in_currency,cl.status,u.country,u.province FROM international_transfer_claims cl JOIN users u ON u.id=cl.user_id WHERE cl.id=$1',[id])).rows[0];
  if(!claim)throw new Error('Réclamation introuvable.');territory(a,claim.country,claim.province);
  if(Number(claim.user_id)===Number(a.user.id)||!a.membership.providers.includes(claim.provider))throw new Error('Traitement non autorisé.');
  const existing=(await c.query('SELECT * FROM inter_claim_cases WHERE claim_id=$1',[id])).rows[0];
  if(existing&&Number(existing.agent_user_id)!==Number(a.user.id))throw new Error('Dossier déjà réservé.');
  if(!existing&&!['pending','approved'].includes(claim.status))throw new Error('Dossier clos.');
  const value=existing ? {gross:existing.gross_amount,net:existing.net_amount,rate:existing.exchange_rate,currency:existing.currency}:await pricing(c,claim,a.membership);
  const wallet=(await c.query(`SELECT COALESCE((balances->>$2)::numeric,0)::text AS balance,COALESCE((balances->>$2)::numeric,0)>=$3::numeric AS sufficient FROM wallets WHERE user_id=$1`,[a.user.id,value.currency,value.net])).rows[0];
  return {success:true,...value,balance:wallet?.balance || '0',sufficient:Boolean(existing || wallet?.sufficient),existing:Boolean(existing),feePercent:existing?.fee_percent || a.membership.fee_percent};
 }finally{c.release();}
}

class InterPinFailure extends Error {
 constructor(public userId:number){super('PIN incorrect.');}
}
async function rollback(c:PoolClient,error:unknown) {
 await c.query('ROLLBACK');
 // Reuse the released transaction's connection: no nested pool acquisition, and failed attempts survive rollback.
 if(error instanceof InterPinFailure)await audit(c,null,error.userId,'PIN_REJECTED').catch(e=>console.error('[Inter PIN audit]',e.code));
}

async function identityDetail(c:PoolClient,claim:any) {
 const data=(await c.query(`SELECT u.full_name,u.first_name,u.last_name,u.signature_image,d.id AS user_document_id,d.id_type,d.id_number,d.id_front_image,d.id_back_image,d.id_expiry_date
 FROM international_transfer_claims cl JOIN users u ON u.id=cl.user_id LEFT JOIN user_documents d ON d.id=cl.user_document_id AND d.user_id=u.id WHERE cl.id=$1`,[claim.id])).rows[0];
 if(!data)return claim;
 const {signature_image,id_front_image,id_back_image,...fields}=data;
 const base=`/api/v1/inter-agent/claims/${claim.id}/identity`;
 return {...claim,...fields,identityReady:Boolean(signature_image&&id_front_image&&data.id_number&&(!data.id_expiry_date||new Date(data.id_expiry_date)>new Date())),identityMedia:{front:id_front_image?`${base}/front`:null,back:id_back_image?`${base}/back`:null,signature:signature_image?`${base}/signature`:null}};
}

export async function interIdentityAsset(id:number,asset:string) {
 const identity=await getAuthenticatedUser();if(!identity)throw new Error('Authentification requise.');
 const c=await db.getConnection();try{
 const a=await actor(c,identity);
 const item=(await c.query(`SELECT ic.agent_user_id,ic.supervisor_user_id,cl.user_id,u.country,u.province,u.signature_image,d.id_front_image,d.id_back_image FROM inter_claim_cases ic JOIN international_transfer_claims cl ON cl.id=ic.claim_id JOIN users u ON u.id=cl.user_id LEFT JOIN user_documents d ON d.id=cl.user_document_id AND d.user_id=u.id WHERE ic.claim_id=$1`,[id])).rows[0];
 if(!item)throw new Error('Données non dévoilées.');territory(a,item.country,item.province);
 if(Number(item.agent_user_id)!==Number(a.user.id)&&!a.supervisor)throw new Error('Accès interdit.');
 const field=({front:'id_front_image',back:'id_back_image',signature:'signature_image'} as Record<string,string>)[asset];
 if(!field||!item[field])throw new Error('Pièce indisponible.');
 await audit(c,id,a.user.id,'IDENTITY_ASSET_VIEW',{asset});return String(item[field]);
 }finally{c.release();}
}

/** National intervention transfers responsibility and the same financial hold atomically. */
export async function takeOverInterClaim(id:number,suppliedPin:string,maxNet:string,currency:string){
 const identity=await getAuthenticatedUser();if(!identity)throw new Error('Authentification requise.');
 const c=await db.getConnection();try{
  await c.query('BEGIN');const a=await actor(c,identity);await pin(c,a.user.id,suppliedPin);
  if(a.membership?.kind!=='supervisor')throw new Error('Nomination inter nationale requise.');
  const item=(await c.query(`SELECT ic.*,cl.user_id,cl.provider,u.country,u.province FROM inter_claim_cases ic JOIN international_transfer_claims cl ON cl.id=ic.claim_id JOIN users u ON u.id=cl.user_id WHERE ic.claim_id=$1 FOR UPDATE OF ic,cl`,[id])).rows[0];
  if(!item)throw new Error('Dossier non réservé.');territory(a,item.country,item.province);
  if(item.user_id===a.user.id||!a.membership.providers.includes(item.provider))throw new Error('Intervention non autorisée.');
  if(item.status!=='reserved'||item.funds_collected)throw new Error('Un dossier encaissé, en litige ou clos ne peut pas être transféré.');
  if(String(currency)!==item.currency||String(maxNet)!==String(item.net_amount))throw new Error('Confirmez le montant exact de la réservation.');
  if(Number(item.agent_user_id)===Number(a.user.id)){await c.query('COMMIT');return {success:true};}
  const tx=(await c.query("SELECT id FROM transactions WHERE id=$1 AND sender_id=$2 AND receiver_id=$3 AND status='Pending' AND type_code='INTL_AGENT_HOLD' AND amount=$4 AND currency=$5 FOR UPDATE",[item.hold_transaction_id,item.agent_user_id,item.user_id,item.net_amount,item.currency])).rows[0];
  if(!tx)throw new Error('Réservation comptable incohérente.');
  const locks=await c.query('SELECT user_id FROM wallets WHERE user_id=ANY($1::int[]) ORDER BY user_id FOR UPDATE',[[a.user.id,item.agent_user_id]]);if(locks.rows.length!==2)throw new Error('Portefeuille absent.');
  const debit=await c.query(`UPDATE wallets SET balances=jsonb_set(COALESCE(balances,'{}'::jsonb),ARRAY[$2::text],to_jsonb(COALESCE((balances->>$2)::numeric,0)-$3::numeric)) WHERE user_id=$1 AND COALESCE((balances->>$2)::numeric,0)>=$3::numeric RETURNING user_id`,[a.user.id,item.currency,item.net_amount]);
  if(!debit.rows.length)throw new Error('Approvisionnez le wallet national avant de reprendre ce dossier.');
  await c.query(`UPDATE wallets SET balances=jsonb_set(COALESCE(balances,'{}'::jsonb),ARRAY[$2::text],to_jsonb(COALESCE((balances->>$2)::numeric,0)+$3::numeric)) WHERE user_id=$1`,[item.agent_user_id,item.currency,item.net_amount]);
  await c.query('UPDATE transactions SET sender_id=$2,sender_wallet_id=$3,metadata=metadata || $4::jsonb WHERE id=$1',[tx.id,a.user.id,a.user.id_wallet,JSON.stringify({previousAgentId:item.agent_user_id,interventionBy:a.user.id})]);
  await c.query('UPDATE inter_claim_cases SET agent_user_id=$2,supervisor_user_id=$2 WHERE claim_id=$1',[id,a.user.id]);
  await audit(c,id,a.user.id,'NATIONAL_TAKEOVER',{previousAgentId:item.agent_user_id,net:item.net_amount,currency:item.currency});
  await signal(c,id,item.user_id,'Prise en charge par un agent inter national',item.agent_user_id,a.user.id);
  await c.query('COMMIT');return {success:true};
 }catch(e){await rollback(c,e);throw e;}finally{c.release();}
}
