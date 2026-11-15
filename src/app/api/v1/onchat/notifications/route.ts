import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getAuthenticatedUser} from '@/lib/actions/user.actions';
export const dynamic='force-dynamic';

/** Durable, authenticated recovery; the shared /ws remains the primary live transport. */
export async function GET(request:Request){
 try{
  const user=await getAuthenticatedUser();
  if(!user)return NextResponse.json({success:false,error:'Authentification requise.'},{status:401});
  const raw=new URL(request.url).searchParams.get('cursor');
  let cursor={at:new Date(Date.now()-24*3600000).toISOString(),id:''};
  if(raw){
   try{cursor=JSON.parse(Buffer.from(raw,'base64url').toString());if(typeof cursor.at!=='string'||!Number.isFinite(Date.parse(cursor.at))||typeof cursor.id!=='string'||cursor.id.length>200)throw Error();}
   catch{return NextResponse.json({success:false,error:'Curseur invalide.'},{status:400});}
  }
  const result=await db.query(`WITH activity AS (
   SELECT 'd:'||m.id::text AS event_id,m.created_at,m.conversation_id::text AS conversation_id,m.id::text AS id,m.sender_id,m.content,m.type,m.metadata,m.status,m.is_read,s.full_name AS sender_name,s.profile_photo AS sender_avatar
   FROM messages m JOIN conversation_participants cp ON cp.conversation_id=m.conversation_id AND cp.user_id=$1 JOIN users s ON s.id=m.sender_id
   WHERE m.sender_id<>$1 AND COALESCE(m.is_read,FALSE)=FALSE
   UNION ALL
   SELECT 'g:'||gm.group_id::text||':'||gm.id::text,gm.created_at,'g_'||gm.group_id::text,gm.id::text,gm.sender_id,gm.content,gm.type,gm.metadata,'sent',FALSE,s.full_name,s.profile_photo
   FROM group_messages gm JOIN group_members member ON member.group_id=gm.group_id AND member.user_id=$1 AND member.status='active' JOIN users s ON s.id=gm.sender_id
   LEFT JOIN onchat_group_reads r ON r.group_id=gm.group_id AND r.user_id=$1
   WHERE gm.sender_id<>$1 AND (r.last_read_at IS NULL OR gm.created_at>r.last_read_at)
  ) SELECT *,TO_CHAR(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at FROM activity WHERE (created_at,event_id)>($2::timestamptz,$3::text) ORDER BY created_at,event_id LIMIT 100`,[user.id,cursor.at,cursor.id]);
  const events=result.rows.map((row:any)=>({event:'chat.message.created',data:{conversationId:row.conversation_id,message:{id:row.id,senderId:row.sender_id,senderName:row.sender_name,senderAvatar:row.sender_avatar,content:row.content||'',type:row.type,metadata:typeof row.metadata==='string'?JSON.parse(row.metadata):row.metadata,status:row.status,isRead:row.is_read,timestamp:new Date(row.created_at).toISOString()}}}));
  const calls=await db.query(`SELECT cl.*,u.full_name,u.id_wallet,u.profile_photo,
   CASE WHEN cl.receiver_id=$1 THEN cl.started_at ELSE invite.created_at END AS ringing_at
   FROM call_logs cl JOIN users u ON u.id=cl.caller_id
   LEFT JOIN onchat_call_invitees invite ON invite.call_id=cl.id AND invite.user_id=$1 AND invite.status='pending'
   WHERE cl.ended_at IS NULL AND cl.meeting_code IS NOT NULL AND cl.caller_id<>$1
    AND ((cl.receiver_id=$1 AND cl.accepted_at IS NULL AND cl.status='MISSED') OR invite.user_id=$1)
    AND CASE WHEN cl.receiver_id=$1 THEN cl.started_at ELSE invite.created_at END>NOW()-INTERVAL '25 seconds'
   ORDER BY ringing_at DESC LIMIT 10`,[user.id]);
  for(const row of calls.rows)events.push({event:'call.offer',data:{callId:row.id,callerName:row.full_name,callerWalletId:row.id_wallet,callerAvatar:row.profile_photo,isVideo:row.is_video,meetCode:row.meeting_code,ringForMs:Math.max(0,Math.min(25000,new Date(row.ringing_at).getTime()+25000-Date.now()))}} as any);
  const last=result.rows.at(-1);
  const next=last?{at:last.cursor_at,id:last.event_id}:cursor;
  return NextResponse.json({success:true,events,cursor:Buffer.from(JSON.stringify(next)).toString('base64url'),hasMore:result.rows.length===100},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error:any){console.error('[OnChat notification recovery]',error.code || error.message);return NextResponse.json({success:false,error:'Notifications temporairement indisponibles.'},{status:503});}
}
