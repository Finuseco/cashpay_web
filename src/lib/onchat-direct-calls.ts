import { db } from '@/lib/db';
import { randomUUID, randomBytes } from 'crypto';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import type { PoolClient } from 'pg';

async function session() { const user=await getAuthenticatedUser();if(!user||String(user.status).toLowerCase()!=='active')throw new Error('Compte actif et authentification requis.');return user; }
async function emit(c:PoolClient,callId:string,event:string,targetId?:number,actorId?:number) {
 await c.query("SELECT pg_notify('onchat_calls',$1)",[JSON.stringify({callId,event,targetId,actorId})]);
}
export async function directCallAccess(c:PoolClient,meetingCode:string,userId:number) {
 const {rows}=await c.query('SELECT * FROM call_logs WHERE meeting_code=$1',[meetingCode]);
 const call=rows[0];if(!call)return false;
 if(call.ended_at)throw new Error('Appel terminé.');
 const invited=await c.query("SELECT 1 FROM onchat_call_invitees WHERE call_id=$1 AND user_id=$2 AND status<>'rejected'",[call.id,userId]);
 if(![Number(call.caller_id),Number(call.receiver_id)].includes(Number(userId))&&!invited.rows.length&&!call.allow_link_join)throw new Error('Une invitation personnelle est requise pour cet appel.');
 const active=await c.query('SELECT user_id FROM meeting_participants mp JOIN meetings m ON m.id=mp.meeting_id WHERE m.meeting_provider_id=$1 AND mp.left_at IS NULL',[meetingCode]);
 if(active.rows.length>=10&&!active.rows.some(row=>Number(row.user_id)===Number(userId)))throw new Error('Cet appel a atteint sa limite de dix participants.');
 return true;
}
export async function startDirectCall(receiverWalletId:string,isVideo:boolean) {
 const user=await session();const c=await db.getConnection();
 try {
  await c.query('BEGIN');
  const {rows}=await c.query("SELECT id FROM users WHERE id_wallet=$1 AND LOWER(status)='active'",[String(receiverWalletId).trim().toUpperCase()]);
  const receiver=rows[0];if(!receiver||receiver.id===user.id)throw new Error('Destinataire invalide.');
  const id=`call_${randomUUID()}`,code=randomBytes(12).toString('hex');
  const url=`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.cashpay-all.com'}/feedback/call/${id}`;
  await c.query(`INSERT INTO meetings(host_user_id,topic,meeting_provider_id,join_url,type,status,price_amount,price_currency)
   VALUES($1,$2,$3,$4,$5,'active',0,'USD')`,[user.id,'Appel OnChat',code,url,isVideo?'video':'audio']);
  const result=await c.query(`INSERT INTO call_logs(id,caller_id,receiver_id,is_video,status,duration_seconds,started_at,meeting_code)
   VALUES($1,$2,$3,$4,'MISSED',0,NOW(),$5) RETURNING *`,[id,user.id,receiver.id,isVideo,code]);
  await emit(c,id,'call.offer',receiver.id,user.id);
  await c.query('COMMIT');return {success:true,call:{...result.rows[0],joinUrl:url}};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function getDirectCall(id:string) {
 const user=await session();const c=await db.getConnection();
 try {
  const {rows}=await c.query(`SELECT cl.*,caller.full_name AS caller_name,caller.profile_photo AS caller_photo,caller.id_wallet AS caller_wallet_id,
   receiver.full_name AS receiver_name,receiver.profile_photo AS receiver_photo,receiver.id_wallet AS receiver_wallet_id
   FROM call_logs cl JOIN users caller ON caller.id=cl.caller_id JOIN users receiver ON receiver.id=cl.receiver_id WHERE cl.id=$1`,[id]);
  if(!rows[0]||!rows[0].meeting_code)throw new Error('Appel introuvable.');
  await directCallAccess(c,rows[0].meeting_code,user.id);
  return {success:true,call:rows[0],selfId:user.id};
 }finally{c.release();}
}
export async function respondDirectCall(id:string,status:string) {
 const user=await session();const c=await db.getConnection();
 try {
  await c.query('BEGIN');
  const {rows}=await c.query('SELECT * FROM call_logs WHERE id=$1 FOR UPDATE',[id]);const call=rows[0];
  if(!call||call.ended_at)throw new Error('Appel inexistant ou terminé.');
  const invited=await c.query("SELECT 1 FROM onchat_call_invitees WHERE call_id=$1 AND user_id=$2 AND status<>'rejected'",[id,user.id]);
  if(Number(call.receiver_id)!==Number(user.id)&&!invited.rows.length)throw new Error('Vous ne pouvez pas répondre à cet appel.');
  const accepted=['ACCEPTED','COMPLETED'].includes(status.toUpperCase());
  if(!accepted&&!['REJECTED','BUSY','MISSED'].includes(status.toUpperCase()))throw new Error('Réponse invalide.');
  if(invited.rows.length)await c.query('UPDATE onchat_call_invitees SET status=$3 WHERE call_id=$1 AND user_id=$2',[id,user.id,accepted?'accepted':'rejected']);
  else await c.query(`UPDATE call_logs SET status=$2,accepted_at=CASE WHEN $3 THEN COALESCE(accepted_at,NOW()) ELSE accepted_at END,
   ended_at=CASE WHEN $3 THEN NULL ELSE NOW() END WHERE id=$1`,[id,accepted?'COMPLETED':status.toUpperCase(),accepted]);
  if(!accepted&&!invited.rows.length)await c.query("UPDATE meetings SET status='ended' WHERE meeting_provider_id=$1",[call.meeting_code]);
  await emit(c,id,accepted?'call.accepted':'call.rejected',call.caller_id,user.id);
  await c.query('COMMIT');return {success:true,call:{...call,joinUrl:`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.cashpay-all.com'}/feedback/call/${id}`}};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function inviteToDirectCall(id:string,input:{walletId?:string;allowLinkJoin?:boolean}) {
 const user=await session();const c=await db.getConnection();
 try {
  await c.query('BEGIN');const {rows}=await c.query('SELECT * FROM call_logs WHERE id=$1 FOR UPDATE',[id]);const call=rows[0];
  if(!call||call.ended_at)throw new Error('Appel terminé.');
  await directCallAccess(c,call.meeting_code,user.id);
  const joined=await c.query('SELECT 1 FROM meeting_participants mp JOIN meetings m ON m.id=mp.meeting_id WHERE m.meeting_provider_id=$1 AND mp.user_id=$2 AND mp.left_at IS NULL',[call.meeting_code,user.id]);
  if(!joined.rows.length&&Number(call.caller_id)!==Number(user.id))throw new Error('Rejoignez l’appel avant d’inviter.');
  if(input.allowLinkJoin!==undefined) {
   if(Number(call.caller_id)!==Number(user.id))throw new Error('Seul l’initiateur peut autoriser le lien de participation.');
   await c.query('UPDATE call_logs SET allow_link_join=$2,is_conference=TRUE WHERE id=$1',[id,input.allowLinkJoin===true]);
  }
  if(input.walletId) {
   const target=await c.query("SELECT id FROM users WHERE id_wallet=$1 AND LOWER(status)='active'",[input.walletId.trim().toUpperCase()]);
   if(!target.rows[0]||target.rows[0].id===user.id||[Number(call.caller_id),Number(call.receiver_id)].includes(Number(target.rows[0].id)))throw new Error('Invité invalide.');
   const count=await c.query("SELECT COUNT(*)::int AS total FROM onchat_call_invitees WHERE call_id=$1 AND status<>'rejected'",[id]);
   if(count.rows[0].total>=8)throw new Error('Limite de huit invités atteinte pour cet appel.');
   await c.query(`INSERT INTO onchat_call_invitees(call_id,user_id,invited_by) VALUES($1,$2,$3)
    ON CONFLICT(call_id,user_id) DO UPDATE SET status='pending',invited_by=EXCLUDED.invited_by`,[id,target.rows[0].id,user.id]);
   await c.query('UPDATE call_logs SET is_conference=TRUE WHERE id=$1',[id]);
   await emit(c,id,'call.offer',target.rows[0].id,user.id);
  }
  await c.query('COMMIT');return {success:true};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function finishDirectCall(id:string) {
 const user=await session();const c=await db.getConnection();
 try {
  await c.query('BEGIN');const {rows}=await c.query('SELECT * FROM call_logs WHERE id=$1 FOR UPDATE',[id]);const call=rows[0];
  if(!call)throw new Error('Appel introuvable.');
  if(![Number(call.caller_id),Number(call.receiver_id)].includes(Number(user.id))) {
   const member=await c.query('SELECT 1 FROM onchat_call_invitees WHERE call_id=$1 AND user_id=$2',[id,user.id]);
   const joined=await c.query('SELECT 1 FROM meeting_participants mp JOIN meetings m ON m.id=mp.meeting_id WHERE m.meeting_provider_id=$1 AND mp.user_id=$2 AND mp.left_at IS NULL',[call.meeting_code,user.id]);
   if(!member.rows.length&&!joined.rows.length)throw new Error('Vous ne participez pas à cet appel.');
  }
  if(call.ended_at){await c.query('COMMIT');return {success:true};}
  await directCallAccess(c,call.meeting_code,user.id);
  // In a conference only its initiator ends it for everybody; other members leave.
  const endsAll=!call.is_conference||Number(call.caller_id)===Number(user.id);
  if(endsAll) {
   await c.query(`UPDATE call_logs SET ended_at=NOW(),duration_seconds=CASE WHEN accepted_at IS NULL THEN 0 ELSE GREATEST(0,EXTRACT(EPOCH FROM NOW()-accepted_at)::integer) END WHERE id=$1`,[id]);
   await c.query("UPDATE meetings SET status='ended' WHERE meeting_provider_id=$1",[call.meeting_code]);
   await emit(c,id,'call.ended',undefined,user.id);
   await c.query("SELECT pg_notify('onchat_meetings',$1)",[JSON.stringify({meetCode:call.meeting_code})]);
  }
  await c.query('UPDATE meeting_participants SET left_at=NOW() WHERE meeting_id=(SELECT id FROM meetings WHERE meeting_provider_id=$1) AND user_id=$2',[call.meeting_code,user.id]);
  await c.query('COMMIT');return {success:true};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
