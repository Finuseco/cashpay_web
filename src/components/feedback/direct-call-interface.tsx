'use client';
import { useEffect,useRef,useState } from 'react';
import { Mic,MicOff,Video,VideoOff,PhoneOff,Volume2,SwitchCamera,UserPlus,Copy,Loader2,ArrowLeft } from 'lucide-react';
import { useMeetRoom } from '@/hooks/use-meet-room';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';

async function api(path:string,body?:object){const response=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error || 'Appel indisponible.');return data;}
function closeSurface(){const bridge=(window as any).OnChatAudio;if(bridge?.closeCall)bridge.closeCall();else window.location.assign('/feedback');}
export function DirectCallInterface({callId}:{callId:string}) {
 const [context,setContext]=useState<any>(null),[error,setError]=useState(''),[joining,setJoining]=useState(false);
 useEffect(()=>{let active=true;api(`/api/v1/calls/${encodeURIComponent(callId)}`).then(data=>{if(active)setContext(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[callId]);
 async function join(){setJoining(true);try{await api(`/api/v1/meetings/${context.call.meeting_code}/join`,{});setContext({...context,admitted:true});}catch(e:any){setError(e.message);}finally{setJoining(false);}}
 useEffect(()=>{if(context&&!context.admitted&&Number(context.call.caller_id)===Number(context.selfId))void join();},[context]);
 // Accepting on Android has already been an explicit action. Browser invitees confirm here.
 useEffect(()=>{if(context&&!context.admitted&&Number(context.call.caller_id)!==Number(context.selfId)&&new URLSearchParams(location.search).get('accepted')==='1')void join();},[context]);
 if(context?.admitted)return <ConnectedCall callId={callId} context={context}/>;
 return <main className="h-[100dvh] flex flex-col justify-center items-center gap-6 text-white bg-gradient-to-b from-[#4768ef] to-[#13a9d8] p-8"><h1 className="text-3xl">Appel OnChat</h1><p>{context?.call.caller_name || 'Connexion…'}</p>{error&&<p role="alert">{error}</p>}{context&&<Button onClick={join} disabled={joining}>{joining?<Loader2 className="animate-spin mr-2"/>:null}Rejoindre en {context.call.is_video?'vidéo':'audio'}</Button>}<Button variant="ghost" onClick={closeSurface}>Retour</Button></main>;
}
function Stream({stream,muted=false,className=''}:{stream:MediaStream|null;muted?:boolean;className?:string}) {
 const ref=useRef<HTMLVideoElement>(null);
 useEffect(()=>{const video=ref.current;if(!video)return;video.srcObject=stream;void video.play().catch(()=>{});return()=>{video.srcObject=null;};},[stream]);
 return <video ref={ref} autoPlay playsInline muted={muted} className={className}/>;
}
function ConnectedCall({callId,context}:{callId:string;context:any}) {
 const room=useMeetRoom(context.call.meeting_code,context.call.is_video);
 const [muted,setMuted]=useState(false),[camera,setCamera]=useState(Boolean(context.call.is_video)),[speaker,setSpeaker]=useState(false),[elapsed,setElapsed]=useState(0),[error,setError]=useState(''),[invite,setInvite]=useState(false),[wallet,setWallet]=useState(''),[busy,setBusy]=useState(false),[conference,setConference]=useState(Boolean(context.call.is_conference));
 const joinedAt=useRef<number|null>(null),closing=useRef(false);
 const others=room.peers, connected=others.some(peer=>peer.state==='connected');
 const caller=Number(context.call.caller_id)===Number(context.selfId);
 const name=caller?context.call.receiver_name:context.call.caller_name;
 const avatar=caller?context.call.receiver_photo:context.call.caller_photo;
 useEffect(()=>{void room.join();return()=>{room.leave();};},[]);
 useEffect(()=>{(window as any).OnChatAudio?.connected?.(connected);if(connected&&joinedAt.current===null)joinedAt.current=Date.now();const timer=setInterval(()=>{if(joinedAt.current!==null)setElapsed(Math.floor((Date.now()-joinedAt.current)/1000));},1000);return()=>clearInterval(timer);},[connected]);
 useEffect(()=>{const timer=setInterval(()=>{api(`/api/v1/calls/${callId}`).then(data=>setConference(Boolean(data.call.is_conference))).catch(()=>{room.leave();closeSurface();});},5000);return()=>clearInterval(timer);},[callId]);
 useEffect(()=>{if(connected)(window as any).OnChatAudio?.mediaState?.(camera);},[connected,camera]);
 useEffect(()=>{if(!caller)return;const timeout=setTimeout(()=>{if(joinedAt.current===null)void hangup();},45000);return()=>clearTimeout(timeout);},[]);
 async function hangup(){if(closing.current)return;closing.current=true;try{await api(`/api/v1/calls/${callId}/end`,{});room.leave();closeSurface();}catch(e:any){closing.current=false;setError(e.message);}}
 async function video(){const next=!camera;const ok=await room.setCameraEnabled(next);if(ok)setCamera(next);}
 function audioRoute(){const bridge=(window as any).OnChatAudio;if(!bridge?.setSpeaker){setError('Le routage audio se règle depuis votre navigateur ou votre appareil.');return;}bridge.setSpeaker(!speaker);setSpeaker(!speaker);}
 async function invitation(link=false){setBusy(true);setError('');try{await api(`/api/v1/calls/${callId}/invite`,link?{allowLinkJoin:true}:{walletId:wallet});setConference(true);if(link){await navigator.clipboard.writeText(location.origin+`/feedback/call/${callId}`);}else{setWallet('');setInvite(false);}}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 const duration=`${Math.floor(elapsed/60).toString().padStart(2,'0')}:${(elapsed%60).toString().padStart(2,'0')}`;
 const remoteVideo=others.find(peer=>peer.cameraEnabled!==false&&peer.stream?.getVideoTracks().some(track=>!track.muted));
 const videoMode=camera||Boolean(remoteVideo);
 return <main className={`relative h-[100dvh] w-full overflow-hidden text-white ${videoMode?'bg-zinc-950':'bg-gradient-to-b from-[#4768ef] via-[#338cea] to-[#12add5]'}`}>
  {!connected&&camera&&!conference&&<div className="absolute inset-0"><Stream stream={room.localStream} muted className="w-full h-full object-cover"/><span className="absolute top-28 left-4 text-xs bg-black/40 p-2 rounded">Votre caméra — en attente du correspondant</span></div>}
  {remoteVideo&&!conference&&<Stream stream={remoteVideo.stream} className="absolute inset-0 h-full w-full object-cover"/>}
  {conference&&<div className="absolute inset-0 grid grid-cols-2 gap-2 p-3 pt-28 pb-40 overflow-y-auto">{others.map(peer=><div key={peer.userId} className="rounded-2xl bg-zinc-800 overflow-hidden relative min-h-36"><Stream stream={peer.stream} className="w-full h-full object-cover"/><span className="absolute bottom-2 left-2 bg-black/50 rounded px-2 text-xs">{peer.name || 'Participant'}</span></div>)}</div>}
  {!remoteVideo&&!conference&&(!camera||connected)&&<div className="absolute inset-x-0 top-[19%] flex flex-col items-center gap-5 px-4"><div className="rounded-full p-3 bg-white/10 ring-[12px] ring-white/5"><div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full overflow-hidden bg-white/20 flex items-center justify-center text-6xl">{avatar?<img src={avatar} alt={name} className="w-full h-full object-cover"/>:String(name || '?').slice(0,1)}</div></div><h1 className="text-4xl font-normal text-center">{name}</h1><p className="text-xl">{connected?duration:room.status==='error'?'Connexion interrompue':'Attente · ·'}</p></div>}
  {(remoteVideo||conference||(!connected&&camera))&&<div className="absolute top-[14%] inset-x-0 text-center pointer-events-none"><h1 className="text-3xl drop-shadow">{conference?'Appel de groupe':name}</h1><p>{connected?duration:'Connexion…'}</p></div>}
  {camera&&(connected||conference)&&<div className="absolute top-32 right-4 h-36 w-24 rounded-2xl overflow-hidden border border-white/40 bg-black"><Stream stream={room.localStream} muted className="w-full h-full object-cover"/><span className="absolute bottom-1 left-2 text-xs">Vous</span></div>}
  {!camera&&room.localStream&&<Stream stream={room.localStream} muted className="hidden"/>}
  {/* Every remote stream remains attached so audio continues when the avatar is displayed. */}
  {others.filter(peer=>peer!==remoteVideo&&!conference).map(peer=><Stream key={peer.userId} stream={peer.stream} className="hidden"/>)}
  <div className="absolute top-10 inset-x-0 px-5 flex justify-between"><button aria-label="Quitter l’appel" onClick={hangup} className="p-3 rounded-full bg-black/10"><ArrowLeft/></button><button onClick={()=>setInvite(true)} aria-label="Inviter un participant" className="p-3 rounded-full bg-black/10"><UserPlus/></button></div>
  {videoMode&&<button aria-label="Haut-parleur" onClick={audioRoute} className="absolute right-5 top-24 rounded-full p-3 bg-black/20"><Volume2/></button>}
  {(error||room.error)&&<p role="alert" className="absolute bottom-36 inset-x-4 bg-black/60 rounded-xl p-3 text-sm">{error||room.error}</p>}
  <footer className="absolute bottom-0 inset-x-0 px-3 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] flex justify-around gap-2 bg-gradient-to-t from-black/30 to-transparent">
   <Control label={camera?'Retourner':'Haut-parleur'} active={speaker} onClick={()=>{if(camera)void room.flipCamera();else audioRoute();}} icon={camera?<SwitchCamera/>:<Volume2/>}/>
   <Control label={camera?'Arrêter vidéo':'Activer vidéo'} active={!camera} onClick={()=>void video()} icon={camera?<Video/>:<VideoOff/>}/>
   <Control label={muted?'Réactiver':'Muet'} active={muted} onClick={()=>{room.setMicEnabled(muted);setMuted(!muted);}} icon={muted?<MicOff/>:<Mic/>}/>
   <Control label="Raccrocher" danger onClick={()=>void hangup()} icon={<PhoneOff/>}/>
  </footer>
  <Dialog open={invite} onOpenChange={setInvite}><DialogContent className="text-foreground"><DialogHeader><DialogTitle>Inviter dans l’appel {camera?'vidéo':'audio'}</DialogTitle></DialogHeader><Input placeholder="ID wallet du participant" value={wallet} onChange={e=>setWallet(e.target.value)}/><Button disabled={busy||!wallet.trim()} onClick={()=>invitation()}>{busy&&<Loader2 className="animate-spin mr-2 h-4 w-4"/>}Envoyer une invitation</Button>{caller&&<Button variant="outline" disabled={busy} onClick={()=>invitation(true)}><Copy className="h-4 w-4 mr-2"/>Autoriser et copier le lien de participation</Button>}<p className="text-sm text-muted-foreground">Une invitation transforme l’appel en conférence. Le lien n’est ouvert aux autres comptes que si l’initiateur l’autorise.</p>{error&&<p role="alert">{error}</p>}</DialogContent></Dialog>
 </main>;
}
function Control({label,icon,onClick,active=false,danger=false}:{label:string;icon:React.ReactNode;onClick:()=>void;active?:boolean;danger?:boolean}){return <button onClick={onClick} className="flex flex-col items-center gap-2 text-xs sm:text-sm min-w-0 flex-1"><span className={`flex h-16 w-16 sm:h-20 sm:w-20 rounded-full items-center justify-center [&>svg]:h-8 [&>svg]:w-8 ${danger?'bg-red-600 text-white':active?'bg-white text-sky-600':'bg-white/15 text-white'}`}>{icon}</span><span>{label}</span></button>;}
