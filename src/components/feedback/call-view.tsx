
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { Call, User } from '@/lib/types';
import { Button } from '../ui/button';
import { PhoneOff, Mic, MicOff, Video, VideoOff, RefreshCw, ScreenShare } from 'lucide-react';
import { useAudioFeedback } from '@/hooks/use-audio-feedback';
import { useTranslation } from "react-i18next";
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { cn } from '@/lib/utils';

export function CallView({ call, currentUser, onHangUp }: { call: Call; currentUser: User, onHangUp: (reason: Call['status']) => void }) {
    const { t } = useTranslation();
    const audioFeedback = useAudioFeedback();
    const [statusText, setStatusText] = useState(t('callStatusRinging', 'Appel en cours...'));
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // This effect manages the call sounds and timers
    useEffect(() => {
        let callTimer: NodeJS.Timeout;
        if (call.status === 'ringing') {
            audioFeedback.playOutgoingCallSound();
        } else if (call.status === 'connected') {
            setStatusText(t('callStatusConnected', 'Connecté'));
            audioFeedback.stopAllSounds();
            callTimer = setInterval(() => setDuration(d => d + 1), 1000);
        }

        return () => {
            audioFeedback.stopAllSounds();
            clearInterval(callTimer);
        };
    }, [call.status, audioFeedback, t]);
    
    // This effect simulates the WebRTC connection logic
    useEffect(() => {
        // Here you would implement the WebRTC connection logic
        // 1. Get local media stream
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                // 2. Connect to signaling server (Node.js + Socket.io)
                // 3. Create PeerConnection, add stream
                // 4. Exchange SDP and ICE candidates
                // 5. On remote stream received, set it to remoteVideoRef
                
                // MOCK: Simulate remote stream appearing after a delay
                const remoteStreamTimeout = setTimeout(() => {
                    if (remoteVideoRef.current) {
                        // In a real app, this would be the stream from the peer.
                         remoteVideoRef.current.srcObject = stream; 
                    }
                }, 3000);

                 return () => {
                    clearTimeout(remoteStreamTimeout);
                    stream.getTracks().forEach(track => track.stop());
                };
            })
            .catch(err => {
                console.error("Failed to get local stream", err);
                onHangUp('ended');
            });
    }, [onHangUp]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }
    
    const callee = call.callee.id === currentUser.id ? call.caller : call.callee;

    return (
        <div className="absolute inset-0 bg-zinc-900 text-white z-50 flex flex-col items-center justify-between p-6">
            <div className="text-center pt-8">
                <Avatar className="h-28 w-28 mx-auto mb-4 border-4 border-zinc-700">
                    <AvatarImage src={callee.profile_photo || ''} alt={callee.full_name} />
                    <AvatarFallback className="text-4xl">{callee.first_name?.[0]}</AvatarFallback>
                </Avatar>
                <h2 className="text-3xl font-bold">{callee.full_name}</h2>
                <p className="text-zinc-400 mt-2">{formatDuration(duration)}</p>
            </div>
            
            <div className="relative w-full h-full">
                <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover rounded-lg" />
                 <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-24 h-32 object-cover rounded-lg border-2 border-white" />
            </div>

            <div className="flex items-center justify-center gap-4">
                 <Button onClick={() => setIsMuted(!isMuted)} variant="outline" size="lg" className={cn("rounded-full h-16 w-16 bg-white/10 border-none", isMuted && "bg-red-500 hover:bg-red-600")}>
                    {isMuted ? <MicOff /> : <Mic />}
                </Button>
                 <Button onClick={() => setIsCameraOff(!isCameraOff)} variant="outline" size="lg" className={cn("rounded-full h-16 w-16 bg-white/10 border-none", isCameraOff && "bg-red-500 hover:bg-red-600")}>
                    {isCameraOff ? <VideoOff /> : <Video />}
                </Button>
                <Button onClick={() => onHangUp('ended')} variant="destructive" size="lg" className="rounded-full h-16 w-16">
                    <PhoneOff />
                </Button>
                <Button variant="outline" size="lg" className="rounded-full h-16 w-16 bg-white/10 border-none"><ScreenShare /></Button>
                <Button variant="outline" size="lg" className="rounded-full h-16 w-16 bg-white/10 border-none"><RefreshCw /></Button>
            </div>
        </div>
    );
}
