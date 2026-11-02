import {AccessToken,RoomServiceClient} from 'livekit-server-sdk';
import {db} from '@/lib/db';
import {MeetingAccessError} from '@/lib/meeting-access';
export function sfuConfigured(){return Boolean(process.env.LIVEKIT_URL&&process.env.LIVEKIT_API_KEY&&process.env.LIVEKIT_API_SECRET);}
export const mediaRoomName=(code:string)=>`onchat-${code}`;
export function mediaCapacity(){const value=Number(process.env.ONCHAT_MEET_MAX_PARTICIPANTS||250);return Number.isSafeInteger(value)&&value>=2&&value<=1000?value:250;}
export function mediaService(){
 if(!sfuConfigured())throw new Error('Serveur média non configuré.');
 return new RoomServiceClient(process.env.LIVEKIT_API_URL||process.env.LIVEKIT_URL!.replace(/^wss:/,'https:'),process.env.LIVEKIT_API_KEY!,process.env.LIVEKIT_API_SECRET!);
}
export async function meetingConnection(code:string,userId:number){
 const {rows}=await db.query(`SELECT m.id,m.host_user_id,m.topic,mp.can_speak,mp.is_host,u.full_name,u.profile_photo
  FROM meetings m JOIN meeting_participants mp ON mp.meeting_id=m.id AND mp.user_id=$2
  JOIN users u ON u.id=mp.user_id WHERE m.meeting_provider_id=$1 AND m.status='active' AND mp.left_at IS NULL AND mp.removed_at IS NULL`,[code,userId]);
 const row=rows[0];if(!row)throw new MeetingAccessError(403,'ADMISSION_REQUIRED','Rejoignez d’abord cette réunion avec votre compte.');
 if(!sfuConfigured())return {success:true,transport:'mesh',maxParticipants:8};
 const url=process.env.LIVEKIT_URL!;if(!url.startsWith('wss://'))throw new Error('Une adresse média WSS publique est requise.');
 const isHost=Number(row.host_user_id)===userId;
 const canPublish=isHost||Boolean(row.is_host||row.can_speak);
 await mediaService().createRoom({name:mediaRoomName(code),maxParticipants:mediaCapacity(),emptyTimeout:300});
 const token=new AccessToken(process.env.LIVEKIT_API_KEY!,process.env.LIVEKIT_API_SECRET!,{identity:String(userId),name:row.full_name||`Participant ${userId}`,metadata:JSON.stringify({avatar:row.profile_photo||null}),ttl:300});
 token.addGrant({roomJoin:true,room:mediaRoomName(code),canSubscribe:true,canPublish,canPublishData:false,roomAdmin:false});
 return {success:true,transport:'livekit',url,token:await token.toJwt(),meetCode:code,roomName:mediaRoomName(code),selfId:userId,isHost,canPublish,topic:row.topic,maxParticipants:mediaCapacity()};
}
export async function syncMediaPermission(code:string,userId:number,enabled:boolean){
 if(!sfuConfigured())return;
 const service=mediaService();
 const participant=await service.getParticipant(mediaRoomName(code),String(userId)).catch((error:any)=>{if(error?.status===404||error?.code==='not_found')return null;throw error;});
 if(!participant)return;
 await service.updateParticipant(mediaRoomName(code),String(userId),{permission:{canPublish:enabled,canSubscribe:true,canPublishData:false}});
}
export async function removeMediaParticipant(code:string,userId:number){if(sfuConfigured())await mediaService().removeParticipant(mediaRoomName(code),String(userId),{revokeTokenTs:BigInt(Math.floor(Date.now()/1000))}).catch((error:any)=>{if(error?.status!==404&&error?.code!=='not_found')throw error;});}
export async function endMediaRoom(code:string){if(sfuConfigured())await mediaService().deleteRoom(mediaRoomName(code)).catch((error:any)=>{if(error?.status!==404&&error?.code!=='not_found')throw error;});}
