'use client';

import { openOnChatSocket, whenOnChatSocketOpen, onChatSocketAddress } from '@/lib/onchat-browser-socket';
import {useSfuMeetRoom} from '@/hooks/use-sfu-meet-room';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Visioconférence multi-participants en maillage WebRTC.
 * Signalisation : WebSocket OnChat (/ws, même cookie de session que l'app) — événements
 * meet.join / meet.peers / meet.peer_joined / meet.peer_left / meet.signal.
 * Le nouvel arrivant envoie les offres aux participants déjà présents.
 */

export interface RemotePeer {
    userId: number;
    name?: string;
    avatar?: string | null;
    microphoneEnabled?: boolean;
    isSpeaking?: boolean;
    screenStream?: MediaStream | null;
    isScreenSharing?: boolean;
    cameraEnabled?: boolean;
    stream: MediaStream | null;
    state: RTCPeerConnectionState | 'new';
}

type RoomStatus = 'idle' | 'media' | 'connecting' | 'joined' | 'error' | 'ended';

const ICE_SERVERS: RTCIceServer[] = (() => {
    const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    const turn = process.env.NEXT_PUBLIC_TURN_URL;
    if (turn) {
        servers.push({
            urls: turn,
            username: process.env.NEXT_PUBLIC_TURN_USERNAME,
            credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        });
    }
    return servers;
})();

function wsUrl() {
    const native = (window as any).OnChatAudio?.connectionUrl?.();
    if (typeof native === 'string' && native.startsWith('wss://')) return native;
    const custom = process.env.NEXT_PUBLIC_ONCHAT_WS_URL;
    if (custom) return custom;
    return onChatSocketAddress();
}

async function acquireMedia(constraints:MediaStreamConstraints):Promise<MediaStream>{
 let expired=false;
 let timer:ReturnType<typeof setTimeout>;
 const media=navigator.mediaDevices.getUserMedia(constraints).then(stream=>{if(expired)stream.getTracks().forEach(track=>track.stop());return stream;});
 try{return await Promise.race([media,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{expired=true;reject(new Error('Autorisez le micro et la caméra, puis réessayez.'));},20000);})]);}
 finally{clearTimeout(timer!);}
}

export function useMeshMeetRoom(meetCode: string, withVideo: boolean) {
    const [canSpeak, setCanSpeak] = useState(false);
    const permissionsRef = useRef<Map<number, boolean>>(new Map());
    const selfIdRef = useRef<number | null>(null);
    const canSpeakRef = useRef(false);
    const desiredMicRef = useRef(true);
    const desiredCameraRef = useRef(withVideo);
    const [status, setStatus] = useState<RoomStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [peers, setPeers] = useState<RemotePeer[]>([]);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const socketRef = useRef<WebSocket | null>(null);
    const localRef = useRef<MediaStream | null>(null);
    const screenRef = useRef<MediaStream | null>(null);
    const remoteStreamsRef = useRef<Map<number, MediaStream>>(new Map());
    const joinEpochRef = useRef(0);
    const pcs = useRef<Map<number, RTCPeerConnection>>(new Map());
    const pendingIce = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
    const closedRef = useRef(false);

    const updatePeer = useCallback((userId: number, patch: Partial<RemotePeer>) => {
        setPeers((prev) => {
            const i = prev.findIndex((p) => p.userId === userId);
            if (i === -1) return [...prev, { userId, stream: null, state: 'new', ...patch }];
            const next = [...prev];
            next[i] = { ...next[i], ...patch };
            return next;
        });
    }, []);

    const removePeer = useCallback((userId: number) => {
        pcs.current.get(userId)?.close();
        pcs.current.delete(userId);
        remoteStreamsRef.current.delete(userId);
        pendingIce.current.delete(userId);
        setPeers((prev) => prev.filter((p) => p.userId !== userId));
    }, []);

    const sendWs = useCallback((event: string, data: Record<string, unknown>) => {
        const s = socketRef.current;
        if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify({ event, data }));
    }, []);

    const signal = useCallback(
        (to: number, payload: unknown) => sendWs('meet.signal', { meetCode, to, payload }),
        [sendWs, meetCode]
    );

    const createPc = useCallback(
        (userId: number) => {
            const existing = pcs.current.get(userId);
            if (existing) return existing;
            const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            pcs.current.set(userId, pc);
            const video=screenRef.current?.getVideoTracks()||localRef.current?.getVideoTracks()||[];
            [...(localRef.current?.getAudioTracks()||[]),...video].forEach(track=>pc.addTrack(track,screenRef.current||localRef.current!));
            if (!video.length) pc.addTransceiver('video', { direction: 'sendrecv' });
            pc.onicecandidate = (e) => {
                if (e.candidate) signal(userId, { type: 'ice', candidate: e.candidate.toJSON() });
            };
            pc.ontrack = (e) => {
                const stream = remoteStreamsRef.current.get(userId) || new MediaStream();
                if (!stream.getTracks().some(track => track.id === e.track.id)) stream.addTrack(e.track);
                remoteStreamsRef.current.set(userId, stream);
                stream.getTracks().forEach(track => { track.enabled = permissionsRef.current.get(userId) === true; });
                updatePeer(userId, { stream });
            };
            pc.onconnectionstatechange = () => {
                updatePeer(userId, { state: pc.connectionState });
                if (pc.connectionState === 'failed') setError('La liaison audio/vidéo a échoué. Vérifiez la connexion et le relais TURN du serveur.');
            };
            updatePeer(userId, {});
            return pc;
        },
        [signal, updatePeer]
    );

    const callPeer = useCallback(
        async (userId: number) => {
            const pc = createPc(userId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            signal(userId, { type: 'offer', sdp: pc.localDescription });
            signal(userId, { type: 'media-state', cameraEnabled: desiredCameraRef.current, microphoneEnabled:desiredMicRef.current&&canSpeakRef.current, screenSharing:Boolean(screenRef.current) });
        },
        [createPc, signal]
    );

    const flushIce = useCallback(async (userId: number, pc: RTCPeerConnection) => {
        const queue = pendingIce.current.get(userId) || [];
        pendingIce.current.delete(userId);
        for (const c of queue) {
            try { await pc.addIceCandidate(c); } catch { /* ignoré */ }
        }
    }, []);

    const handleSignal = useCallback(
        async (from: number, payload: any) => {
            try {
                if (payload?.type === 'media-state') { updatePeer(from, {...(typeof payload.cameraEnabled==='boolean'?{cameraEnabled:payload.cameraEnabled}:{}),...(typeof payload.screenSharing==='boolean'?{isScreenSharing:payload.screenSharing}:{}),...(typeof payload.microphoneEnabled==='boolean'?{microphoneEnabled:payload.microphoneEnabled}:{})}); return; }
                if (payload?.type === 'offer') {
                    const pc = createPc(from);
                    await pc.setRemoteDescription(payload.sdp);
                    await flushIce(from, pc);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    signal(from, { type: 'answer', sdp: pc.localDescription });
                    signal(from, { type: 'media-state', cameraEnabled: desiredCameraRef.current, microphoneEnabled:desiredMicRef.current&&canSpeakRef.current, screenSharing:Boolean(screenRef.current) });
                } else if (payload?.type === 'answer') {
                    const pc = pcs.current.get(from);
                    if (pc) {
                        await pc.setRemoteDescription(payload.sdp);
                        await flushIce(from, pc);
                    }
                } else if (payload?.type === 'ice') {
                    const pc = pcs.current.get(from);
                    if (pc && pc.remoteDescription) {
                        await pc.addIceCandidate(payload.candidate);
                    } else {
                        const q = pendingIce.current.get(from) || [];
                        q.push(payload.candidate);
                        pendingIce.current.set(from, q);
                    }
                }
            } catch (e) {
                console.error('[meet] signal', e);
            }
        },
        [createPc, flushIce, signal]
    );

    const leave = useCallback(() => {
        (window as any).OnChatAudio?.mediaStopped?.();
        closedRef.current = true;
        joinEpochRef.current += 1;
        sendWs('meet.leave', { meetCode });
        if(socketRef.current||localRef.current)fetch(`/api/v1/meetings/${encodeURIComponent(meetCode)}/leave`, { method: 'POST', keepalive: true }).catch(() => undefined);
        socketRef.current?.close();
        socketRef.current = null;
        pcs.current.forEach((pc) => pc.close());
        pcs.current.clear();
        remoteStreamsRef.current.clear();
        localRef.current?.getTracks().forEach((t) => t.stop());
        screenRef.current?.getTracks().forEach((t) => t.stop());
        localRef.current = null;
        screenRef.current = null;
        setLocalStream(null);
        setPeers([]);
        setIsScreenSharing(false);
        setStatus('ended');
    }, [sendWs, meetCode]);

    const join = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
            setError("Ce navigateur ne prend pas en charge les appels vidéo (WebRTC). Utilisez Chrome, Edge, Firefox ou Safari récent, en HTTPS.");
            setStatus('error');
            return;
        }
        closedRef.current = false;
        const joinEpoch = ++joinEpochRef.current;
        setError(null);
        setStatus('media');

        let stream: MediaStream;
        try {
            stream = await acquireMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: withVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
            });
        } catch {
            try {
                // Repli : audio seul si la caméra est refusée/absente.
                stream = await acquireMedia({ audio: true, video: false });
            } catch {
                setError("Accès au micro/à la caméra refusé. Autorisez-le dans le navigateur puis réessayez.");
                setStatus('error');
                return;
            }
        }
        if (joinEpoch !== joinEpochRef.current || closedRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
        stream.getTracks().forEach(track => { track.enabled = false; });
        (window as any).OnChatAudio?.mediaState?.(withVideo);
        localRef.current = stream;
        setLocalStream(stream);
        setStatus('connecting');

        let socket: WebSocket;
        try { socket = await openOnChatSocket(wsUrl()); }
        catch (failure) { (window as any).OnChatAudio?.mediaStopped?.();stream.getTracks().forEach(track=>track.stop());setError((failure as Error).message);setStatus('error');return; }
        if (joinEpoch !== joinEpochRef.current || closedRef.current) { socket.close();stream.getTracks().forEach(track=>track.stop());return; }
        socketRef.current = socket;

        const admissionDeadline = setTimeout(() => {
            if (socketRef.current !== socket || closedRef.current) return;
            setError('La connexion à la réunion n’a pas été confirmée. Réessayez.');
            setStatus('error');
            stream.getTracks().forEach(track => track.stop());
            (window as any).OnChatAudio?.mediaStopped?.();
            socket.close();
        }, 20000);
        socket.onmessage = async (ev) => {
            let msg: any;
            try { msg = JSON.parse(ev.data); } catch { return; }
            const { event, data } = msg || {};
            if (event === 'meet.updated') {
                window.dispatchEvent(new CustomEvent('onchat-meeting-updated', { detail: data }));
            } else if(event==='meet.mute'&&data?.meetCode===meetCode){
                desiredMicRef.current=false;localRef.current?.getAudioTracks().forEach(track=>{track.enabled=false;});
                if(localRef.current)setLocalStream(new MediaStream(localRef.current.getTracks()));
                pcs.current.forEach((_pc,id)=>signal(id,{type:'media-state',microphoneEnabled:false}));
            } else if(event==='meet.kicked'){
                leave();setError('L’organisateur a retiré votre accès à cette réunion.');
            } else if (event === 'meet.ended') {
                leave(); setError('L’organisateur a terminé la réunion.');
            } else if (event === 'meet.permissions') {
                const userId = Number(data.userId);
                permissionsRef.current.set(userId, Boolean(data.canSpeak));
                const selfId = selfIdRef.current;
                if (userId === selfId) {
                    canSpeakRef.current = Boolean(data.canSpeak);
                    setCanSpeak(Boolean(data.canSpeak));
                    localRef.current?.getAudioTracks().forEach(track => { track.enabled = Boolean(data.canSpeak) && desiredMicRef.current; });
                    localRef.current?.getVideoTracks().forEach(track => { track.enabled = Boolean(data.canSpeak) && desiredCameraRef.current; });
                    if (!data.canSpeak) {
                        localRef.current?.getVideoTracks().forEach(track => { track.enabled = false; });
                        desiredMicRef.current=false;desiredCameraRef.current=false;
                        screenRef.current?.getTracks().forEach(track => track.stop());screenRef.current=null;setScreenStream(null);setIsScreenSharing(false);
                        (window as any).OnChatAudio?.mediaStopped?.();
                    }
                }
                if(!data.canSpeak)updatePeer(userId,{cameraEnabled:false,microphoneEnabled:false,isScreenSharing:false});
                pcs.current.get(userId)?.getReceivers().forEach(receiver => { if (receiver.track) receiver.track.enabled = Boolean(data.canSpeak); });
            } else if (event === 'meet.peers') {
                clearTimeout(admissionDeadline);
                selfIdRef.current = Number(data.selfId);
                setStatus('joined');
                for (const id of data.peers as number[]) {
                    updatePeer(Number(id), { name: data.names?.[id], avatar: data.avatars?.[id] });
                    await callPeer(Number(id));
                }
            } else if (event === 'meet.peer_joined') {
                updatePeer(Number(data.userId), { name: data.name, avatar: data.avatar }); // il nous enverra l'offre
            } else if (event === 'meet.peer_left') {
                removePeer(Number(data.userId));
            } else if (event === 'meet.signal') {
                await handleSignal(Number(data.from), data.payload);
            } else if (event === 'error' && String(data?.code || '').startsWith('MEET_')) {
                clearTimeout(admissionDeadline);
                setError(data.message || 'Erreur de réunion.');
                setStatus('error');
                localRef.current?.getTracks().forEach((t) => t.stop());
            }
        };
        socket.onerror = () => {
            clearTimeout(admissionDeadline);
            stream.getTracks().forEach(track => track.stop());
            (window as any).OnChatAudio?.mediaStopped?.();
            socket.close();
            if (!closedRef.current) {
                setError('Connexion au serveur de signalisation impossible.');
                setStatus('error');
            }
        };
        socket.onclose = () => {
            clearTimeout(admissionDeadline);
            stream.getTracks().forEach(track => track.stop());
            (window as any).OnChatAudio?.mediaStopped?.();
            pcs.current.forEach(pc=>pc.close());pcs.current.clear();
            remoteStreamsRef.current.clear();setPeers([]);setLocalStream(null);
            if (!closedRef.current) {
                setError((prev) => prev ?? 'Connexion perdue avec le serveur.');
                setStatus((s) => (s === 'ended' ? s : 'error'));
            }
        };
        whenOnChatSocketOpen(socket, () => sendWs('meet.join', { meetCode }));
    }, [callPeer, handleSignal, meetCode, removePeer, sendWs, updatePeer, withVideo, leave]);

    const setMicEnabled = useCallback((enabled: boolean) => {
        desiredMicRef.current = enabled;
        localRef.current?.getAudioTracks().forEach((t) => (t.enabled = enabled && canSpeakRef.current));
        pcs.current.forEach((_pc,id)=>signal(id,{type:'media-state',microphoneEnabled:enabled&&canSpeakRef.current}));
    }, [signal]);
    const facingRef = useRef<'user'|'environment'>('user');
    const switchCamera = useCallback(async (enabled: boolean, flip = false) => {
        if (!canSpeakRef.current || !localRef.current) return false;
        if(screenRef.current){setError('Arrêtez le partage d’écran avant de changer de caméra.');return false;}
        try {
            if (!enabled) {
                desiredCameraRef.current = false;
                if (!screenRef.current) for (const pc of pcs.current.values()) {
                    const sender = pc.getTransceivers().find(item => item.receiver.track.kind === 'video')?.sender;
                    if (sender) await sender.replaceTrack(null);
                }
                localRef.current.getVideoTracks().forEach(track => { localRef.current?.removeTrack(track); track.stop(); });
                setLocalStream(new MediaStream(localRef.current.getTracks()));
                pcs.current.forEach((_pc,id) => signal(id,{type:'media-state',cameraEnabled:Boolean(screenRef.current)}));
                return true;
            }
            if (enabled && (!localRef.current.getVideoTracks().some(track => track.readyState === 'live') || flip)) {
                if (flip) facingRef.current = facingRef.current === 'user' ? 'environment' : 'user';
                const previous = localRef.current.getVideoTracks();
                if (flip) previous.forEach(track => track.stop());
                const capture = await acquireMedia({ video: { facingMode: { ideal: facingRef.current }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
                const track = capture.getVideoTracks()[0];
                for (const pc of pcs.current.values()) {
                    const sender = pc.getTransceivers().find(item => item.receiver.track.kind === 'video')?.sender;
                    if (sender) await sender.replaceTrack(track);
                }
                previous.forEach(old => { localRef.current?.removeTrack(old); old.stop(); });
                localRef.current.addTrack(track);
                setLocalStream(new MediaStream(localRef.current.getTracks()));
            }
            desiredCameraRef.current = enabled;
            localRef.current.getVideoTracks().forEach(track => { track.enabled = enabled; });
            if(enabled)for(const pc of pcs.current.values()){const sender=pc.getTransceivers().find(item=>item.receiver.track.kind==='video')?.sender;if(sender)await sender.replaceTrack(localRef.current.getVideoTracks()[0]||null);}
            pcs.current.forEach((_pc,id) => signal(id,{type:'media-state',cameraEnabled:enabled}));
            return true;
        } catch { setError('Impossible d’activer cette caméra. Vérifiez les autorisations.'); return false; }
    }, [signal]);
    const setCameraEnabled = useCallback((enabled: boolean) => switchCamera(enabled), [switchCamera]);
    const flipCamera = useCallback(() => switchCamera(true,true),[switchCamera]);

    const replaceVideoTrack = useCallback((track: MediaStreamTrack | null) => {
        pcs.current.forEach((pc) => {
            const sender = pc.getTransceivers().find(item=>item.receiver.track.kind==='video')?.sender;
            if (sender) sender.replaceTrack(track).catch(() => undefined);
        });
    }, []);

    const [screenStream,setScreenStream]=useState<MediaStream|null>(null);
    const toggleScreenShare = useCallback(async () => {
        if (!canSpeakRef.current) return;
        if (screenRef.current) {
            screenRef.current.getTracks().forEach((t) => t.stop());
            screenRef.current = null;
            replaceVideoTrack(localRef.current?.getVideoTracks()[0] ?? null);
            setIsScreenSharing(false);setScreenStream(null);
            pcs.current.forEach((_pc,id)=>signal(id,{type:'media-state',cameraEnabled:desiredCameraRef.current,screenSharing:false}));
            return;
        }
        try {
            const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
            screenRef.current = screen;
            const track = screen.getVideoTracks()[0];
            track.onended = () => {
                screenRef.current = null;
                replaceVideoTrack(localRef.current?.getVideoTracks()[0] ?? null);
                setIsScreenSharing(false);setScreenStream(null);
                pcs.current.forEach((_pc,id)=>signal(id,{type:'media-state',cameraEnabled:desiredCameraRef.current,screenSharing:false}));
            };
            replaceVideoTrack(track);
            setScreenStream(screen);setIsScreenSharing(true);
            pcs.current.forEach((_pc,id)=>signal(id,{type:'media-state',cameraEnabled:true,screenSharing:true}));
        } catch { setError('Le partage d’écran a été annulé ou n’est pas disponible sur cet appareil.'); }
    }, [replaceVideoTrack,signal]);

    useEffect(() => () => { if (!closedRef.current) leave(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return { status, error, canSpeak, peers, localStream, screenStream, isScreenSharing, join, leave, setMicEnabled, setCameraEnabled, flipCamera, toggleScreenShare };
}

/** Admission is complete before transport selection; a media token never bypasses billing. */
export function useMeetRoom(meetCode:string,withVideo:boolean){
 const mesh=useMeshMeetRoom(meetCode,withVideo),sfu=useSfuMeetRoom(meetCode,withVideo);
 const [transport,setTransport]=useState<'mesh'|'livekit'>('mesh'),[connecting,setConnecting]=useState(false),[connectionError,setConnectionError]=useState<string|null>(null);
 const generation=useRef(0),transportRef=useRef<'mesh'|'livekit'>('mesh');
 async function join(){
  const epoch=++generation.current;setConnecting(true);setConnectionError(null);
  try{
   const response=await fetch(`/api/v1/meetings/${encodeURIComponent(meetCode)}/connection`,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(20000)});const ticket=await response.json();
   if(!response.ok||!ticket.success)throw new Error(ticket.error||'Admission média indisponible.');
   if(epoch!==generation.current)return;
   const mode=ticket.transport==='livekit'?'livekit':'mesh';transportRef.current=mode;setTransport(mode);
   if(mode==='livekit')await sfu.join(ticket);else await mesh.join();
  }catch(error){if(epoch===generation.current)setConnectionError((error as Error).message);}
  finally{if(epoch===generation.current)setConnecting(false);}
 }
 function leave(){generation.current++;if(transportRef.current==='livekit'){sfu.leave();void fetch(`/api/v1/meetings/${encodeURIComponent(meetCode)}/leave`,{method:'POST',keepalive:true});}else mesh.leave();}
 useEffect(()=>()=>{generation.current++;},[]);
 const active=transport==='livekit'?sfu:mesh;
 return {...active,setVisibleTracks:transport==='livekit'?sfu.setVisibleTracks:undefined,transport,status:connectionError?'error' as const:connecting?'connecting' as const:active.status,error:connectionError||active.error,join,leave};
}
