'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Room,RoomEvent,Track,ConnectionState,DisconnectReason,LocalVideoTrack,RemoteTrackPublication,VideoQuality} from 'livekit-client';
import type {RemotePeer} from '@/hooks/use-meet-room';
export type MediaTicket={transport:'livekit'|'mesh';url?:string;token?:string;meetCode:string;selfId:number;isHost:boolean;canPublish:boolean;topic:string;maxParticipants:number};
export function useSfuMeetRoom(meetCode:string,withVideo:boolean){
 const ref=useRef<Room|null>(null),intentional=useRef(false),streams=useRef(new Map<string,MediaStream>()),visibility=useRef<{keys:Set<string>;main:string}|null>(null),subscriptions=useRef(new Map<string,string>()),facing=useRef<'user'|'environment'>('user');
 const [status,setStatus]=useState<'idle'|'media'|'connecting'|'joined'|'error'|'ended'>('idle'),[error,setError]=useState<string|null>(null),[canSpeak,setCanSpeak]=useState(false),[peers,setPeers]=useState<RemotePeer[]>([]),[localStream,setLocalStream]=useState<MediaStream|null>(null),[screenStream,setScreenStream]=useState<MediaStream|null>(null),[isScreenSharing,setSharing]=useState(false);
 const rebuild=useCallback(()=>{
  const room=ref.current;if(!room)return;
  function media(key:string,tracks:MediaStreamTrack[]){const previous=streams.current.get(key);if(previous&&previous.getTracks().map(t=>t.id).join(',')===tracks.map(t=>t.id).join(','))return previous;const stream=new MediaStream(tracks);streams.current.set(key,stream);return stream;}
  function track(participant:any,source:Track.Source){const publication=participant.getTrackPublication(source);return publication&&!publication.isMuted?publication.track?.mediaStreamTrack:undefined;}
  const participants=Array.from(room.remoteParticipants.values());
  for(const participant of participants)for(const item of participant.trackPublications.values()){
   const publication=item as RemoteTrackPublication;
   const key=publication.source===Track.Source.ScreenShare?`${participant.identity}-screen`:participant.identity;
   const subscribed=publication.kind===Track.Kind.Audio||(visibility.current?visibility.current.keys.has(key):participants.indexOf(participant)<6);
   const setting=`${subscribed}:${visibility.current?.main===key?'high':'low'}`;
   if(subscriptions.current.get(publication.trackSid)!==setting){subscriptions.current.set(publication.trackSid,setting);publication.setSubscribed(subscribed);if(publication.kind===Track.Kind.Video)publication.setVideoQuality(visibility.current?.main===key?VideoQuality.HIGH:VideoQuality.LOW);}
  }
  setPeers(participants.map(participant=>{
   let metadata:any={};try{metadata=JSON.parse(participant.metadata||'{}');}catch{}
   const camera=track(participant,Track.Source.Camera),audio=track(participant,Track.Source.Microphone),screen=track(participant,Track.Source.ScreenShare);
   return {userId:Number(participant.identity),name:participant.name||'Participant',avatar:metadata.avatar||null,isSpeaking:participant.isSpeaking,microphoneEnabled:participant.isMicrophoneEnabled,cameraEnabled:participant.isCameraEnabled,state:room.state===ConnectionState.Connected?'connected':'connecting',stream:media(participant.identity,[camera,audio].filter(Boolean)),screenStream:screen?media(participant.identity+':screen',[screen]):null,isScreenSharing:Boolean(screen)} as RemotePeer;
  }));
  const local=room.localParticipant,camera=track(local,Track.Source.Camera),audio=track(local,Track.Source.Microphone),screen=track(local,Track.Source.ScreenShare);
  setLocalStream(media('self',[camera,audio].filter(Boolean)));if(camera||audio)(window as any).OnChatAudio?.mediaState?.(Boolean(camera));else (window as any).OnChatAudio?.mediaStopped?.();setScreenStream(screen?media('self:screen',[screen]):null);setSharing(Boolean(screen));setCanSpeak(Boolean(local.permissions?.canPublish));
 },[]);
 const join=useCallback(async(ticket:MediaTicket)=>{
  intentional.current=false;setError(null);setStatus('connecting');
  if((window as any).OnChatAudio?.startSfuMeeting&&(window as any).OnChatAudio.nativeMeetingEnabled?.()){(window as any).OnChatAudio.startSfuMeeting(JSON.stringify({...ticket,withVideo}));return;}
  try{
   const room=new Room({adaptiveStream:false,dynacast:true,videoCaptureDefaults:{resolution:{width:1280,height:720,frameRate:24}}});ref.current=room;
   for(const event of [RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,RoomEvent.TrackPublished,RoomEvent.TrackUnpublished,RoomEvent.TrackSubscribed,RoomEvent.TrackUnsubscribed,RoomEvent.TrackMuted,RoomEvent.TrackUnmuted,RoomEvent.LocalTrackPublished,RoomEvent.LocalTrackUnpublished,RoomEvent.ActiveSpeakersChanged,RoomEvent.ParticipantMetadataChanged,RoomEvent.ParticipantPermissionsChanged])room.on(event as any,rebuild);
   room.on(RoomEvent.ParticipantPermissionsChanged,()=>{if(!room.localParticipant.permissions?.canPublish){void room.localParticipant.setMicrophoneEnabled(false);void room.localParticipant.setCameraEnabled(false);void room.localParticipant.setScreenShareEnabled(false);}rebuild();});
   room.on(RoomEvent.Reconnecting,()=>setStatus('connecting'));room.on(RoomEvent.Reconnected,()=>{setStatus('joined');rebuild();});
   room.on(RoomEvent.Disconnected,(reason)=>{(window as any).OnChatAudio?.mediaStopped?.();const ended=intentional.current||[DisconnectReason.ROOM_DELETED,DisconnectReason.PARTICIPANT_REMOVED,DisconnectReason.DUPLICATE_IDENTITY].includes(reason!);setStatus(ended?'ended':'error');if(!ended)setError('La connexion à la réunion a été interrompue. Réessayez.');setPeers([]);setLocalStream(null);setScreenStream(null);});
   let deadline:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([room.connect(ticket.url!,ticket.token!,{autoSubscribe:false}),new Promise<never>((_resolve,reject)=>{deadline=setTimeout(()=>{intentional.current=true;void room.disconnect();reject(new Error('Délai de connexion dépassé.'));},30000);})]);}finally{clearTimeout(deadline);}

   if(intentional.current){await room.disconnect();return;}
   setStatus('joined');rebuild();
   if(ticket.canPublish){await room.localParticipant.setMicrophoneEnabled(true).catch(()=>setError('Autorisez le micro pour prendre la parole.'));if(withVideo)await room.localParticipant.setCameraEnabled(true).catch(()=>setError('Autorisez la caméra pour transmettre votre vidéo.'));rebuild();}
  }catch{setStatus('error');setError('Connexion au serveur média impossible. Vérifiez votre réseau et réessayez.');await ref.current?.disconnect();}
 },[withVideo,rebuild]);
 const leave=useCallback(()=>{intentional.current=true;void ref.current?.disconnect();ref.current=null;streams.current.clear();setPeers([]);setLocalStream(null);setScreenStream(null);setSharing(false);setStatus('ended');},[]);
 async function setMicEnabled(enabled:boolean){try{if(!ref.current?.localParticipant.permissions?.canPublish)return false;await ref.current.localParticipant.setMicrophoneEnabled(enabled);rebuild();return true;}catch{setError('Impossible de modifier le micro.');return false;}}
 async function setCameraEnabled(enabled:boolean){try{if(!ref.current?.localParticipant.permissions?.canPublish)return false;await ref.current.localParticipant.setCameraEnabled(enabled);rebuild();return true;}catch{setError('Impossible de modifier la caméra.');return false;}}
 async function flipCamera(){try{const publication=ref.current?.localParticipant.getTrackPublication(Track.Source.Camera);const camera=publication?.track as LocalVideoTrack|undefined;if(!camera)return false;facing.current=facing.current==='user'?'environment':'user';await camera.restartTrack({facingMode:facing.current});rebuild();return true;}catch{setError('Impossible de retourner la caméra.');return false;}}
 async function toggleScreenShare(){try{const local=ref.current?.localParticipant;if(!local?.permissions?.canPublish)return;await local.setScreenShareEnabled(!local.isScreenShareEnabled,{audio:false});rebuild();}catch{setError('Le partage d’écran a été annulé ou n’est pas disponible sur cet appareil.');}}
 useEffect(()=>()=>{intentional.current=true;void ref.current?.disconnect();},[]);
 const setVisibleTracks=useCallback((keys:string[],main:string)=>{visibility.current={keys:new Set(keys),main};rebuild();},[rebuild]);
 return {setVisibleTracks,status,error,canSpeak,peers,localStream,screenStream,isScreenSharing,join,leave,setMicEnabled,setCameraEnabled,flipCamera,toggleScreenShare};
}
