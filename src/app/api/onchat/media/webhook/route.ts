import {NextResponse} from 'next/server';
import {WebhookReceiver} from 'livekit-server-sdk';
import {db} from '@/lib/db';
import {sfuConfigured,mediaService,syncMediaPermission} from '@/lib/meeting-media';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!sfuConfigured())return NextResponse.json({success:false},{status:503});
 let event;
 try{event=await new WebhookReceiver(process.env.LIVEKIT_API_KEY!,process.env.LIVEKIT_API_SECRET!).receive(await request.text(),request.headers.get('authorization')||'');}
 catch{return NextResponse.json({success:false},{status:401});}
 const code=event.room?.name?.match(/^onchat-([A-Za-z0-9_-]{4,64})$/)?.[1];
 const userId=Number(event.participant?.identity),sid=event.participant?.sid;
 if(!code)return NextResponse.json({success:true});
 try{
  if(event.event==='participant_joined'&&Number.isSafeInteger(userId)&&userId>0&&sid){
   const access=await db.query(`UPDATE meeting_participants p SET media_session_id=$3,left_at=NULL FROM meetings m WHERE p.meeting_id=m.id AND m.meeting_provider_id=$1 AND m.status='active' AND p.user_id=$2 AND p.removed_at IS NULL RETURNING p.can_speak,p.is_host`,[code,userId,sid]);
   if(!access.rows.length)await mediaService().removeParticipant(event.room!.name!,String(userId),{revokeTokenTs:BigInt(Math.floor(Date.now()/1000))});
   else await syncMediaPermission(code,userId,Boolean(access.rows[0].can_speak||access.rows[0].is_host));
  }
  if(event.event==='participant_left'&&sid)await db.query('UPDATE meeting_participants p SET left_at=NOW(),media_session_id=NULL FROM meetings m WHERE p.meeting_id=m.id AND m.meeting_provider_id=$1 AND p.user_id=$2 AND p.media_session_id=$3',[code,userId,sid]);
  await db.query("SELECT pg_notify('onchat_meetings',$1)",[JSON.stringify({meetCode:code})]);
  return NextResponse.json({success:true});
 }catch{return NextResponse.json({success:false},{status:503});}
}
