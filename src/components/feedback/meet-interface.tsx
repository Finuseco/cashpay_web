'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Users, ShieldCheck, Copy, Monitor, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMeetRoom } from '@/hooks/use-meet-room';

interface MeetInterfaceProps {
    meetCode: string;
    user: User;
    withVideo?: boolean;
}

function VideoTile({ stream, muted, label, off }: { stream: MediaStream | null; muted?: boolean; label: string; off?: boolean }) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
    }, [stream]);
    return (
        <div className="relative rounded-2xl bg-zinc-900 border border-zinc-800/50 overflow-hidden min-h-0 min-w-0">
            <video ref={ref} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
            {(off || !stream) && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                    <div className="h-20 w-20 rounded-full bg-zinc-700 flex items-center justify-center text-3xl font-black">{label[0]}</div>
                </div>
            )}
            <span className="absolute bottom-2 left-2 text-xs bg-black/50 rounded px-2 py-0.5">{label}</span>
        </div>
    );
}

export function MeetInterface({ meetCode, user, withVideo = true }: MeetInterfaceProps) {
    const router = useRouter();
    const [elapsed, setElapsed] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(!withVideo);
    const room = useMeetRoom(meetCode, withVideo);
    const { status, error, peers, localStream, isScreenSharing, join, leave } = room;

    useEffect(() => { join(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (status !== 'joined') return;
        const timer = setInterval(() => setElapsed((p) => p + 1), 1000);
        return () => clearInterval(timer);
    }, [status]);

    const fmt = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':');

    const handleLeave = () => { leave(); router.push('/feedback'); };
    const handleCopy = async () => {
        try { await navigator.clipboard.writeText(`${window.location.origin}/feedback/meet/${meetCode}`); } catch { /* ignoré */ }
    };
    const toggleMic = () => { room.setMicEnabled(isMuted); setIsMuted(!isMuted); };
    const toggleCam = () => { room.setCameraEnabled(isCameraOff); setIsCameraOff(!isCameraOff); };

    const tiles = peers.length + 1;
    const cols = tiles <= 1 ? 'grid-cols-1' : tiles <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 lg:grid-cols-3';

    return (
        <div className="flex flex-col h-[100dvh] bg-[#0b0f1a] text-white overflow-hidden">
            <header className="shrink-0 h-14 flex items-center justify-between px-4 bg-black/40">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2 bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/20">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-widest truncate">{meetCode}</p>
                    </div>
                    {status === 'joined' && <Badge variant="outline" className="font-mono border-green-500/30 text-green-500">{fmt(elapsed)}</Badge>}
                    <Badge variant="outline" className="text-zinc-300"><Users className="h-3 w-3 mr-1" />{tiles}</Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={handleCopy} title="Copier le lien"><Copy className="h-4 w-4" /></Button>
            </header>

            <main className={cn('flex-1 min-h-0 p-3 grid gap-3 auto-rows-fr', cols)}>
                <VideoTile stream={localStream} muted label={`${user.first_name || user.full_name} (vous)`} off={isCameraOff} />
                {peers.map((p) => (
                    <VideoTile key={p.userId} stream={p.stream} label={p.name || `Participant ${p.userId}`} />
                ))}
            </main>

            {status === 'connecting' || status === 'media' ? (
                <p className="text-center text-xs text-zinc-400 pb-1 flex items-center justify-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Connexion…</p>
            ) : null}
            {status === 'joined' && peers.length === 0 && (
                <p className="text-center text-xs text-zinc-400 pb-1">En attente d'autres participants. Partagez le lien.</p>
            )}

            {error && (
                <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
                    {status === 'error' && <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={() => join()}>Réessayer</Button>}
                </div>
            )}

            <div className="shrink-0 flex items-center justify-center gap-3 bg-zinc-900/80 border-t border-white/5 p-3">
                <Button variant="outline" size="icon" onClick={toggleMic} className={cn('h-12 w-12 rounded-full', isMuted ? 'bg-red-500 border-red-500 text-white' : 'bg-zinc-800 text-white')}>
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button variant="outline" size="icon" onClick={toggleCam} className={cn('h-12 w-12 rounded-full', isCameraOff ? 'bg-red-500 border-red-500 text-white' : 'bg-zinc-800 text-white')}>
                    {isCameraOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
                </Button>
                <Button variant="outline" size="icon" onClick={room.toggleScreenShare} className={cn('h-12 w-12 rounded-full hidden sm:inline-flex', isScreenSharing ? 'bg-primary text-white' : 'bg-zinc-800 text-white')} title="Partager l'écran">
                    <Monitor className="h-5 w-5" />
                </Button>
                <Button variant="destructive" size="icon" onClick={handleLeave} className="h-12 w-16 rounded-2xl"><PhoneOff className="h-6 w-6" /></Button>
            </div>
        </div>
    );
}
