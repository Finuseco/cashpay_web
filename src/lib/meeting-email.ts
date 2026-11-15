import {db} from '@/lib/db';
import {sendEmail} from '@/services/email';
export const escapeMeetingHtml=(text:any)=>String(text??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function meetingPhase(meeting:any,now=Date.now()){
 if(['ended','completed','cancelled'].includes(String(meeting.status)))return 'ended';
 if(meeting.started_at)return 'live';
 if(meeting.scheduled_at&&new Date(meeting.scheduled_at).getTime()>now)return 'scheduled';
 return 'waiting';
}
function base(){const url=new URL(process.env.NEXT_PUBLIC_APP_URL||'https://app.cashpay-all.com');if(!['https:','http:'].includes(url.protocol))throw new Error('URL OnChat invalide.');return url.origin;}
export function meetingJoinUrl(code:string){return `${base()}/feedback/meet/${encodeURIComponent(code)}`;}
export function meetingCodeFromMessage(content:string,metadata?:any){
 const candidate=metadata?.meetCode || metadata?.meeting?.meetCode;
 if(typeof candidate==='string'&&/^[A-Za-z0-9_-]{4,64}$/.test(candidate))return candidate;
 for(const value of String(content||'').match(/https?:\/\/[^\s<>"']+|\/feedback\/meet\/[A-Za-z0-9_-]+/g)||[]){try{const url=new URL(value.replace(/[),.;!?]+$/g,''),base());if(url.origin!==base())continue;const code=/^\/feedback\/meet\/([A-Za-z0-9_-]{4,64})\/?$/.exec(url.pathname)?.[1];if(code)return code;}catch{}}
 return null;
}
export async function sendMeetingEmail(receiver:{email:string;full_name?:string;first_name?:string},code:string,senderName:string){
 if(!/^[A-Za-z0-9_-]{4,64}$/.test(code))return false;
 const meeting=(await db.query(`SELECT m.topic,m.type,m.status,m.scheduled_at,m.duration_min,m.started_at,m.ended_at FROM meetings m WHERE m.meeting_provider_id=$1 AND NOT EXISTS(SELECT 1 FROM call_logs cl WHERE cl.meeting_code=m.meeting_provider_id)`,[code])).rows[0];
 if(!meeting)return false;
 const phase=meetingPhase(meeting);const labels={live:'En cours',scheduled:'Programmée',waiting:'En attente du démarrage',ended:meeting.status==='cancelled'?'Annulée':'Terminée'};
 const date=(value:any)=>value?new Date(value).toLocaleString('fr-FR',{timeZone:'UTC',dateStyle:'full',timeStyle:'short'})+' UTC':'Non renseigné';
 const plannedEnd=meeting.scheduled_at&&Number(meeting.duration_min)>0?new Date(new Date(meeting.scheduled_at).getTime()+Number(meeting.duration_min)*60000):null;
 const result=await sendEmail(receiver.email,`OnChat · ${labels[phase]} · ${String(meeting.topic).replace(/[\r\n]/g,' ').slice(0,120)}`,'meeting',{
  guestName:escapeMeetingHtml(receiver.first_name||receiver.full_name||'Bonjour'),senderName:escapeMeetingHtml(senderName),topic:escapeMeetingHtml(meeting.topic),mediaType:meeting.type==='audio'?'Audio':'Vidéo',statusLabel:labels[phase],scheduledStart:escapeMeetingHtml(date(meeting.scheduled_at)),scheduledEnd:escapeMeetingHtml(date(plannedEnd)),actualStart:escapeMeetingHtml(date(meeting.started_at)),actualEnd:escapeMeetingHtml(date(meeting.ended_at)),sentAt:escapeMeetingHtml(date(new Date())),joinUrl:escapeMeetingHtml(meetingJoinUrl(code)),buttonText:phase==='ended'?'Consulter l’état de la réunion':phase==='live'?'Rejoindre la réunion':'Ouvrir la réunion',
 });
 return result.success;
}
export async function notifyMeetingStarted(code:string,hostId:number){
 const path=`/feedback/meet/${code}`;
 const {rows}=await db.query(`SELECT DISTINCT u.id,u.email,u.full_name,u.first_name FROM users u WHERE u.id<>$1 AND u.email IS NOT NULL AND LOWER(u.status)='active' AND u.id IN (
 SELECT mp.user_id FROM meeting_participants mp JOIN meetings m ON m.id=mp.meeting_id WHERE m.meeting_provider_id=$2
 UNION SELECT cp.user_id FROM messages msg JOIN conversation_participants cp ON cp.conversation_id=msg.conversation_id WHERE POSITION($3 IN COALESCE(msg.content,''))>0
 UNION SELECT gm.user_id FROM group_messages msg JOIN group_members gm ON gm.group_id=msg.group_id AND gm.status='active' WHERE POSITION($3 IN COALESCE(msg.content,''))>0
 UNION SELECT n.user_id FROM notifications n WHERE n.link=$3 OR n.link=$4
 ) LIMIT 200`,[hostId,code,path,base()+path]);
 const host=(await db.query('SELECT full_name FROM users WHERE id=$1',[hostId])).rows[0];
 for(let start=0;start<rows.length;start+=10)await Promise.allSettled(rows.slice(start,start+10).map(receiver=>sendMeetingEmail(receiver,code,host?.full_name||'L’organisateur')));
}

export async function notifyGroupMeetingShare(code:string,groupId:number,senderId:number){
 const {rows}=await db.query("SELECT u.email,u.full_name,u.first_name FROM users u JOIN group_members gm ON gm.user_id=u.id WHERE gm.group_id=$1 AND gm.status='active' AND u.id<>$2 AND LOWER(u.status)='active' AND u.email IS NOT NULL LIMIT 200",[groupId,senderId]);
 const sender=(await db.query('SELECT full_name FROM users WHERE id=$1',[senderId])).rows[0];
 for(let i=0;i<rows.length;i+=10)await Promise.allSettled(rows.slice(i,i+10).map(user=>sendMeetingEmail(user,code,sender?.full_name||'Un membre du groupe')));
}
