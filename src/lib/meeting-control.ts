import { db } from '@/lib/db';
import { MeetingAccessError } from '@/lib/meeting-access';
import {syncMediaPermission,endMediaRoom,removeMediaParticipant,muteMediaMicrophones} from '@/lib/meeting-media';
export async function controlMeeting(code:string,userId:number,action:'speech'|'hand'|'end'|'mute-all'|'kick',targetUserId?:number,enabled=false){
 const connection=await db.getConnection();
 try{
  await connection.query('BEGIN');
  const {rows}=await connection.query('SELECT id,host_user_id,status FROM meetings WHERE meeting_provider_id=$1 FOR UPDATE',[code]);
  const meeting=rows[0];
  if(!meeting||meeting.status!=='active')throw new MeetingAccessError(404,'MEET_NOT_FOUND','Réunion introuvable ou terminée.');
  if(action!=='hand'&&Number(meeting.host_user_id)!==Number(userId))throw new MeetingAccessError(403,'HOST_REQUIRED','Action réservée à l’organisateur.');
  if((action==='speech'||action==='kick')&&Number(targetUserId)===Number(meeting.host_user_id))throw new MeetingAccessError(400,'HOST_ROLE','Le rôle de l’organisateur ne peut pas être modifié.');
  if(action==='end'){
   // Stop actual media before committing a successful end. A media outage remains retryable.
   await endMediaRoom(code);
   await connection.query("UPDATE meetings SET status='ended',ended_at=COALESCE(ended_at,NOW()) WHERE id=$1",[meeting.id]);
   await connection.query('UPDATE meeting_participants SET left_at=NOW() WHERE meeting_id=$1 AND left_at IS NULL',[meeting.id]);
  }else if(action==='mute-all'){
   await muteMediaMicrophones(code,userId);
  }else{
   if(action==='speech'&&!enabled)await syncMediaPermission(code,Number(targetUserId),false);
   if(action==='kick')await removeMediaParticipant(code,Number(targetUserId));
   const updated=action==='speech'?await connection.query("UPDATE meeting_participants SET can_speak=$1,role=$2,raise_hand=FALSE WHERE meeting_id=$3 AND user_id=$4 AND left_at IS NULL RETURNING id",[enabled,enabled?'speaker':'viewer',meeting.id,targetUserId])
    :action==='kick'?await connection.query('UPDATE meeting_participants SET left_at=NOW(),removed_at=NOW(),can_speak=FALSE,raise_hand=FALSE WHERE meeting_id=$1 AND user_id=$2 RETURNING id',[meeting.id,targetUserId])
    :await connection.query('UPDATE meeting_participants SET raise_hand=$1 WHERE meeting_id=$2 AND user_id=$3 AND left_at IS NULL RETURNING id',[enabled,meeting.id,userId]);
   if(!updated.rows.length)throw new MeetingAccessError(404,'PARTICIPANT_NOT_FOUND','Participant actif introuvable.');
  }
  await connection.query("SELECT pg_notify('onchat_meetings',$1)",[JSON.stringify({meetCode:code,...(action==='mute-all'?{muteAll:true,exceptUserId:userId}:{})})]);
  await connection.query('COMMIT');
  // Grants fail closed: the database authorizes first, then the SFU permits publication.
  if(action==='speech'&&enabled)await syncMediaPermission(code,Number(targetUserId),true);
  return {success:true};
 }catch(error){await connection.query('ROLLBACK');throw error;}finally{connection.release();}
}
