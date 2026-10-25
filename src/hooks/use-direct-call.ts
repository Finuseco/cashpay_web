'use client';

/**
 * Hook WebRTC pour les appels 1-on-1 via le serveur de signalisation OnChat.
 * Événements WS utilisés : call.offer / call.answer / call.ice_candidate /
 *   call.accepted / call.rejected / call.ended
 * Tous les messages incluent conversationId pour que le serveur puisse router.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type DirectCallStatus =
    | 'idle'
    | 'requesting_media'
    | 'ringing'       // appelant : attend que l'autre décroche
    | 'incoming'      // appelé  : a reçu call.offer, peut accepter/refuser
    | 'connecting'
    | 'connected'
    | 'ended'
    | 'rejected'
    | 'missed'
    | 'error';

const ICE_SERVERS: RTCIceServer[] = (() => {
    const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (typeof process !== 'undefined') {
        const turn = process.env.NEXT_PUBLIC_TURN_URL;
        if (turn) {
            servers.push({
                urls: turn,
                username: process.env.NEXT_PUBLIC_TURN_USERNAME,
                credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
            });
        }
    }
    return servers;
})();

function wsUrl() {
    const custom = process.env.NEXT_PUBLIC_ONCHAT_WS_URL;
    if (custom) return custom;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
}

interface UseDirectCallOptions {
    conversationId: string;
    isVideo: boolean;
    /** true = cet appareil démarre l'appel */
    isCaller: boolean;
    /** SDP offre reçue (pour l'appelé seulement) */
    incomingOffer?: RTCSessionDescriptionInit;
    onStatusChange?: (status: DirectCallStatus) => void;
    onRemoteStream?: (stream: MediaStream) => void;
}

export function useDirectCall({
    conversationId,
    isVideo,
    isCaller,
    incomingOffer,
    onStatusChange,
    onRemoteStream,
}: UseDirectCallOptions) {
    const [status, setStatus] = useState<DirectCallStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const socketRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localRef = useRef<MediaStream | null>(null);
    const pendingIce = useRef<RTCIceCandidateInit[]>([]);
    const closedRef = useRef(false);

    const updateStatus = useCallback((s: DirectCallStatus) => {
        setStatus(s);
        onStatusChange?.(s);
    }, [onStatusChange]);

    const sendWs = useCallback((event: string, data: Record<string, unknown>) => {
        const s = socketRef.current;
        if (s && s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify({ event, data: { ...data, conversationId } }));
        }
    }, [conversationId]);

    const cleanup = useCallback(() => {
        closedRef.current = true;
        pcRef.current?.close();
        pcRef.current = null;
        localRef.current?.getTracks().forEach(t => t.stop());
        localRef.current = null;
        setLocalStream(null);
        setRemoteStream(null);
        socketRef.current?.close();
        socketRef.current = null;
    }, []);

    const hangUp = useCallback((reason: 'ended' | 'rejected' | 'missed' = 'ended') => {
        if (!closedRef.current) {
            sendWs('call.ended', { reason });
            updateStatus(reason === 'rejected' ? 'rejected' : 'ended');
        }
        cleanup();
    }, [sendWs, updateStatus, cleanup]);

    const setupPeerConnection = useCallback((socket: WebSocket) => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        localRef.current?.getTracks().forEach(t => pc.addTrack(t, localRef.current!));

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                const s = socket;
                if (s.readyState === WebSocket.OPEN) {
                    s.send(JSON.stringify({
                        event: 'call.ice_candidate',
                        data: { conversationId, candidate: e.candidate.toJSON() },
                    }));
                }
            }
        };

        pc.ontrack = (e) => {
            const stream = e.streams[0] ?? new MediaStream([e.track]);
            setRemoteStream(stream);
            onRemoteStream?.(stream);
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') updateStatus('connected');
            else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
                if (!closedRef.current) {
                    updateStatus('ended');
                    cleanup();
                }
            }
        };

        return pc;
    }, [conversationId, onRemoteStream, updateStatus, cleanup]);

    const handleIncomingMessage = useCallback(async (msg: { event: string; data: any }) => {
        const { event, data } = msg;

        if (event === 'call.accepted') {
            // Appelant : l'autre a accepté, on peut envoyer l'offre
            updateStatus('connecting');
            const pc = pcRef.current;
            if (!pc) return;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const s = socketRef.current;
            if (s?.readyState === WebSocket.OPEN) {
                s.send(JSON.stringify({
                    event: 'call.offer',
                    data: { conversationId, sdp: pc.localDescription },
                }));
            }
        }

        if (event === 'call.offer') {
            // Appelé : reçoit l'offre SDP après avoir accepté
            const pc = pcRef.current;
            if (!pc) return;
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            for (const c of pendingIce.current) {
                try { await pc.addIceCandidate(c); } catch { /* ignoré */ }
            }
            pendingIce.current = [];
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            const s = socketRef.current;
            if (s?.readyState === WebSocket.OPEN) {
                s.send(JSON.stringify({
                    event: 'call.answer',
                    data: { conversationId, sdp: pc.localDescription },
                }));
            }
            updateStatus('connecting');
        }

        if (event === 'call.answer') {
            // Appelant : reçoit la réponse SDP
            const pc = pcRef.current;
            if (!pc) return;
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            for (const c of pendingIce.current) {
                try { await pc.addIceCandidate(c); } catch { /* ignoré */ }
            }
            pendingIce.current = [];
        }

        if (event === 'call.ice_candidate') {
            const pc = pcRef.current;
            if (!pc) return;
            if (pc.remoteDescription) {
                try { await pc.addIceCandidate(data.candidate); } catch { /* ignoré */ }
            } else {
                pendingIce.current.push(data.candidate);
            }
        }

        if (event === 'call.rejected') {
            updateStatus('rejected');
            cleanup();
        }

        if (event === 'call.ended') {
            updateStatus('ended');
            cleanup();
        }
    }, [conversationId, updateStatus, cleanup]);

    // Démarre l'appel (appelant)
    const startCall = useCallback(async () => {
        if (!isCaller || closedRef.current) return;
        closedRef.current = false;
        setError(null);
        updateStatus('requesting_media');

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
            });
        } catch {
            setError("Accès au micro/caméra refusé.");
            updateStatus('error');
            return;
        }
        localRef.current = stream;
        setLocalStream(stream);
        updateStatus('ringing');

        const socket = new WebSocket(wsUrl());
        socketRef.current = socket;

        socket.onopen = () => {
            setupPeerConnection(socket);
            // Notifie l'autre partie qu'il y a un appel entrant
            socket.send(JSON.stringify({
                event: 'call.offer', // premier message = sonnerie (pas encore de SDP)
                data: { conversationId, isVideo, ringing: true },
            }));
        };
        socket.onmessage = async (ev) => {
            let msg: any;
            try { msg = JSON.parse(ev.data); } catch { return; }
            await handleIncomingMessage(msg);
        };
        socket.onerror = () => {
            if (!closedRef.current) { setError('Connexion impossible.'); updateStatus('error'); }
        };
        socket.onclose = () => {
            if (!closedRef.current) updateStatus('ended');
        };
    }, [isCaller, isVideo, conversationId, setupPeerConnection, handleIncomingMessage, updateStatus]);

    // Accepte l'appel entrant (appelé)
    const acceptCall = useCallback(async () => {
        if (isCaller || closedRef.current) return;
        closedRef.current = false;
        setError(null);
        updateStatus('requesting_media');

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
            });
        } catch {
            setError("Accès au micro/caméra refusé.");
            updateStatus('error');
            return;
        }
        localRef.current = stream;
        setLocalStream(stream);

        const socket = new WebSocket(wsUrl());
        socketRef.current = socket;

        socket.onopen = () => {
            const pc = setupPeerConnection(socket);
            // Si on a déjà l'offre SDP entrante, on la traite directement
            if (incomingOffer) {
                pc.setRemoteDescription(new RTCSessionDescription(incomingOffer))
                    .then(() => pc.createAnswer())
                    .then(answer => pc.setLocalDescription(answer))
                    .then(() => {
                        socket.send(JSON.stringify({
                            event: 'call.answer',
                            data: { conversationId, sdp: pc.localDescription },
                        }));
                        updateStatus('connecting');
                    })
                    .catch(e => { setError(String(e)); updateStatus('error'); });
            } else {
                // Signale que l'appel est accepté ; l'appelant enverra l'offre SDP
                socket.send(JSON.stringify({
                    event: 'call.accepted',
                    data: { conversationId },
                }));
                updateStatus('connecting');
            }
        };
        socket.onmessage = async (ev) => {
            let msg: any;
            try { msg = JSON.parse(ev.data); } catch { return; }
            await handleIncomingMessage(msg);
        };
        socket.onerror = () => {
            if (!closedRef.current) { setError('Connexion impossible.'); updateStatus('error'); }
        };
        socket.onclose = () => {
            if (!closedRef.current) updateStatus('ended');
        };
    }, [isCaller, isVideo, conversationId, incomingOffer, setupPeerConnection, handleIncomingMessage, updateStatus]);

    const setMicEnabled = useCallback((enabled: boolean) => {
        localRef.current?.getAudioTracks().forEach(t => { t.enabled = enabled; });
    }, []);

    const setCameraEnabled = useCallback((enabled: boolean) => {
        localRef.current?.getVideoTracks().forEach(t => { t.enabled = enabled; });
    }, []);

    useEffect(() => {
        return () => {
            if (!closedRef.current) cleanup();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        status,
        error,
        localStream,
        remoteStream,
        startCall,
        acceptCall,
        hangUp,
        setMicEnabled,
        setCameraEnabled,
    };
}
