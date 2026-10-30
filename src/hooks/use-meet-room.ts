'use client';

import { openOnChatSocket } from '@/lib/onchat-browser-socket';
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
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
}

export function useMeetRoom(meetCode: string, withVideo: boolean) {
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
            localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));
            if (!localRef.current?.getVideoTracks().length) pc.addTransceiver('video', { direction: 'sendrecv' });
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
            pc.onconnectionstatechange = () => updatePeer(userId, { state: pc.connectionState });
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
            signal(userId, { type: 'media-state', cameraEnabled: desiredCameraRef.current });
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
                if (payload?.type === 'media-state') { updatePeer(from, { cameraEnabled: payload.cameraEnabled === true }); return; }
                if (payload?.type === 'offer') {
                    const pc = createPc(from);
                    await pc.setRemoteDescription(payload.sdp);
                    await flushIce(from, pc);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    signal(from, { type: 'answer', sdp: pc.localDescription });
                    signal(from, { type: 'media-state', cameraEnabled: desiredCameraRef.current });
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
        closedRef.current = true;
        joinEpochRef.current += 1;
        sendWs('meet.leave', { meetCode });
        fetch(`/api/v1/meetings/${encodeURIComponent(meetCode)}/leave`, { method: 'POST', keepalive: true }).catch(() => undefined);
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
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: withVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
            });
        } catch {
            try {
                // Repli : audio seul si la caméra est refusée/absente.
                stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            } catch {
                setError("Accès au micro/à la caméra refusé. Autorisez-le dans le navigateur puis réessayez.");
                setStatus('error');
                return;
            }
        }
        if (joinEpoch !== joinEpochRef.current || closedRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
        stream.getTracks().forEach(track => { track.enabled = false; });
        localRef.current = stream;
        setLocalStream(stream);
        setStatus('connecting');

        let socket: WebSocket;
        try { socket = await openOnChatSocket(wsUrl()); }
        catch (failure) { stream.getTracks().forEach(track=>track.stop());setError((failure as Error).message);setStatus('error');return; }
        if (joinEpoch !== joinEpochRef.current || closedRef.current) { socket.close();stream.getTracks().forEach(track=>track.stop());return; }
        socketRef.current = socket;

        socket.onopen = () => sendWs('meet.join', { meetCode });
        socket.onmessage = async (ev) => {
            let msg: any;
            try { msg = JSON.parse(ev.data); } catch { return; }
            const { event, data } = msg || {};
            if (event === 'meet.updated') {
                window.dispatchEvent(new CustomEvent('onchat-meeting-updated', { detail: data }));
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
                        screenRef.current?.getTracks().forEach(track => track.stop());
                    }
                }
                pcs.current.get(userId)?.getReceivers().forEach(receiver => { if (receiver.track) receiver.track.enabled = Boolean(data.canSpeak); });
            } else if (event === 'meet.peers') {
                selfIdRef.current = Number(data.selfId);
                setStatus('joined');
                for (const id of data.peers as number[]) {
                    updatePeer(Number(id), { name: data.names?.[id] });
                    await callPeer(Number(id));
                }
            } else if (event === 'meet.peer_joined') {
                updatePeer(Number(data.userId), { name: data.name }); // il nous enverra l'offre
            } else if (event === 'meet.peer_left') {
                removePeer(Number(data.userId));
            } else if (event === 'meet.signal') {
                await handleSignal(Number(data.from), data.payload);
            } else if (event === 'error' && String(data?.code || '').startsWith('MEET_')) {
                setError(data.message || 'Erreur de réunion.');
                setStatus('error');
                localRef.current?.getTracks().forEach((t) => t.stop());
            }
        };
        socket.onerror = () => {
            if (!closedRef.current) {
                setError('Connexion au serveur de signalisation impossible.');
                setStatus('error');
            }
        };
        socket.onclose = () => {
            if (!closedRef.current) {
                setError((prev) => prev ?? 'Connexion perdue avec le serveur.');
                setStatus((s) => (s === 'ended' ? s : 'error'));
            }
        };
    }, [callPeer, handleSignal, meetCode, removePeer, sendWs, updatePeer, withVideo, leave]);

    const setMicEnabled = useCallback((enabled: boolean) => {
        desiredMicRef.current = enabled;
        localRef.current?.getAudioTracks().forEach((t) => (t.enabled = enabled && canSpeakRef.current));
    }, []);
    const facingRef = useRef<'user'|'environment'>('user');
    const switchCamera = useCallback(async (enabled: boolean, flip = false) => {
        if (!canSpeakRef.current || !localRef.current) return false;
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
                const capture = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingRef.current }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
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
            pcs.current.forEach((_pc,id) => signal(id,{type:'media-state',cameraEnabled:enabled}));
            return true;
        } catch { setError('Impossible d’activer cette caméra. Vérifiez les autorisations.'); return false; }
    }, [signal]);
    const setCameraEnabled = useCallback((enabled: boolean) => switchCamera(enabled), [switchCamera]);
    const flipCamera = useCallback(() => switchCamera(true,true),[switchCamera]);

    const replaceVideoTrack = useCallback((track: MediaStreamTrack | null) => {
        pcs.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(track).catch(() => undefined);
        });
    }, []);

    const toggleScreenShare = useCallback(async () => {
        if (!canSpeakRef.current) return;
        if (screenRef.current) {
            screenRef.current.getTracks().forEach((t) => t.stop());
            screenRef.current = null;
            replaceVideoTrack(localRef.current?.getVideoTracks()[0] ?? null);
            setIsScreenSharing(false);
            return;
        }
        try {
            const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
            screenRef.current = screen;
            const track = screen.getVideoTracks()[0];
            track.onended = () => {
                screenRef.current = null;
                replaceVideoTrack(localRef.current?.getVideoTracks()[0] ?? null);
                setIsScreenSharing(false);
            };
            replaceVideoTrack(track);
            setIsScreenSharing(true);
        } catch { /* annulé par l'utilisateur */ }
    }, [replaceVideoTrack]);

    useEffect(() => () => { if (!closedRef.current) leave(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return { status, error, canSpeak, peers, localStream, isScreenSharing, join, leave, setMicEnabled, setCameraEnabled, flipCamera, toggleScreenShare };
}
