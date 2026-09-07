
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, 
    Settings, Users, MessageSquare, ShieldCheck, Copy, 
    Share2, PlayCircle, Monitor, AlertTriangle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useWebRtc } from '@/hooks/use-webrtc';

interface MeetInterfaceProps {
    meetCode: string;
    user: User;
}

export function MeetInterface({ meetCode, user }: MeetInterfaceProps) {
    const router = useRouter();
    const [elapsed, setElapsed] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    
    const { 
        status, 
        error, 
        localVideoRef, 
        remoteVideoRef, 
        startLocalStream, 
        endCall 
    } = useWebRtc();

    useEffect(() => {
        startLocalStream();
        const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
        return () => {
            clearInterval(timer);
            endCall();
        };
    }, [startLocalStream, endCall]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
    };

    const handleLeave = () => {
        endCall();
        router.push('/feedback');
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert("Lien de réunion copié dans le presse-papiers.");
    };

    const handleToggleMic = () => {
        if (localVideoRef.current?.srcObject) {
            const stream = localVideoRef.current.srcObject as MediaStream;
            stream.getAudioTracks().forEach(track => track.enabled = isMuted);
            setIsMuted(!isMuted);
        }
    };

    const handleToggleCamera = () => {
        if (localVideoRef.current?.srcObject) {
            const stream = localVideoRef.current.srcObject as MediaStream;
            stream.getVideoTracks().forEach(track => track.enabled = isCameraOff);
            setIsCameraOff(!isCameraOff);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#0b0f1a] text-white overflow-hidden font-sans">
            <header className="h-16 flex items-center justify-between px-6 z-20 bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-primary/20 backdrop-blur-xl px-4 py-2 rounded-2xl border border-primary/20 shadow-2xl">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">{meetCode}</p>
                    </div>
                    {status === 'connected' && (
                        <Badge variant="outline" className="h-8 rounded-full border-green-500/30 text-green-500 font-mono font-bold">
                           <PlayCircle className="h-3 w-3 mr-2 animate-pulse"/> {formatTime(elapsed)}
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleCopyLink} title="Copier le lien"><Copy className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" title="Partager"><Share2 className="h-4 w-4"/></Button>
                </div>
            </header>

            <div className="flex-1 relative p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative rounded-3xl bg-zinc-900 border border-zinc-800/50 overflow-hidden shadow-2xl group">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {isCameraOff && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/80 backdrop-blur-sm">
                            <div className="h-24 w-24 rounded-full bg-zinc-700 flex items-center justify-center border-4 border-white/10 shadow-2xl">
                                <span className="text-3xl font-black">{user.full_name[0]}</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="relative rounded-3xl bg-zinc-900 border border-zinc-800/50 overflow-hidden shadow-2xl flex items-center justify-center">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    {status !== 'connected' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-900">
                            <div className="relative h-20 w-20">
                                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                                <div className="absolute inset-0 rounded-full border-t-4 border-primary animate-spin" />
                                <Users className="absolute inset-0 m-auto h-8 w-8 text-primary/40" />
                            </div>
                            <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-[10px]">Attente de l'interlocuteur</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="h-28 flex items-center justify-center gap-4 bg-zinc-900/80 backdrop-blur-2xl border-t border-white/5 p-6">
                <div className="flex items-center gap-3 sm:gap-6 bg-black/40 p-2 rounded-[2.5rem] border border-white/10 shadow-2xl">
                    <Button variant="outline" size="icon" onClick={handleToggleMic} className={cn("h-12 w-12 rounded-full", isMuted ? "bg-red-500 border-red-500 text-white" : "bg-zinc-800 text-white")}>
                        {isMuted ? <MicOff className="h-5 w-5"/> : <Mic className="h-5 w-5"/>}
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleToggleCamera} className={cn("h-12 w-12 rounded-full", isCameraOff ? "bg-red-500 border-red-500 text-white" : "bg-zinc-800 text-white")}>
                        {isCameraOff ? <VideoOff className="h-5 w-5"/> : <VideoIcon className="h-5 w-5"/>}
                    </Button>
                    <Button variant="destructive" size="icon" onClick={handleLeave} className="h-14 w-16 rounded-[24px] shadow-2xl hover:scale-105 transition-all">
                        <PhoneOff className="fill-current h-6 w-6" />
                    </Button>
                    <Button variant="ghost" size="icon" className={cn("h-12 w-12 rounded-full", showParticipants ? "text-primary bg-primary/10" : "text-zinc-400")}>
                        <Users className="h-5 w-5"/>
                    </Button>
                </div>
            </div>
            {error && (
                <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-sm z-50">
                    <Alert variant="destructive" className="bg-red-500/10 backdrop-blur-xl text-white">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Erreur Média</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </div>
            )}
        </div>
    );
}
