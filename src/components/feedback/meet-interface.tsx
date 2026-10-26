'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Users,
    ShieldCheck, Copy, Monitor, AlertTriangle, Loader2,
    Hand, CheckCheck, X, Crown, Volume2, VolumeX, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMeetRoom } from '@/hooks/use-meet-room';

interface MeetInterfaceProps {
    meetCode: string;
    user: User;
    withVideo?: boolean;
    isHost?: boolean;
}

interface LiveParticipant {
    userId: number;
    name: string;
    avatar: string | null;
    isHost: boolean;
    role: 'host' | 'speaker' | 'viewer';
    raiseHand: boolean;
    canSpeak: boolean;
    joinedAt: string | null;
}

function VideoTile({
    stream, muted, label, off, isMain, raiseHand, canSpeak,
}: {
    stream: MediaStream | null;
    muted?: boolean;
    label: string;
    off?: boolean;
    isMain?: boolean;
    raiseHand?: boolean;
    canSpeak?: boolean;
}) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
    }, [stream]);
    return (
        <div className={cn(
            'relative rounded-2xl bg-zinc-900 border overflow-hidden min-h-0 min-w-0',
            isMain ? 'border-primary/60 ring-2 ring-primary/30' : 'border-zinc-800/50',
        )}>
            <video ref={ref} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
            {(off || !stream) && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                    <div className="h-20 w-20 rounded-full bg-zinc-700 flex items-center justify-center text-3xl font-black">
                        {label[0]}
                    </div>
                </div>
            )}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <span className="text-xs bg-black/60 rounded px-2 py-0.5 truncate max-w-[70%]">{label}</span>
                <div className="flex items-center gap-1">
                    {raiseHand && (
                        <span className="text-xs bg-yellow-500/80 rounded-full px-1.5 py-0.5 animate-bounce">✋</span>
                    )}
                    {canSpeak && !raiseHand && (
                        <span className="text-xs bg-green-500/80 rounded-full px-1.5 py-0.5">🎙</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export function MeetInterface({ meetCode, user, withVideo = true, isHost = false }: MeetInterfaceProps) {
    const router = useRouter();
    const [elapsed, setElapsed] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(!withVideo);
    const [showParticipants, setShowParticipants] = useState(false);
    const [participants, setParticipants] = useState<LiveParticipant[]>([]);
    const [hasRaisedHand, setHasRaisedHand] = useState(false);
    const [grantingId, setGrantingId] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const room = useMeetRoom(meetCode, withVideo);
    const { status, error, peers, localStream, isScreenSharing, join, leave } = room;

    // Auto-join
    useEffect(() => { join(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Elapsed timer
    useEffect(() => {
        if (status !== 'joined') return;
        const timer = setInterval(() => setElapsed((p) => p + 1), 1000);
        return () => clearInterval(timer);
    }, [status]);

    // Poll participants every 8s
    useEffect(() => {
        if (status !== 'joined') return;
        const load = async () => {
            try {
                const res = await fetch(`/api/v1/meetings/${meetCode}/participants`, { credentials: 'same-origin' });
                const data = await res.json().catch(() => null);
                if (data?.success) setParticipants(data.participants || []);
            } catch { /* ignoré */ }
        };
        load();
        const id = setInterval(load, 8000);
        return () => clearInterval(id);
    }, [status, meetCode]);

    const fmt = (s: number) =>
        [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
            .map((v) => String(v).padStart(2, '0'))
            .join(':');

    const handleLeave = () => { leave(); router.push('/feedback'); };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/feedback/meet/${meetCode}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignoré */ }
    };

    const toggleMic = () => { room.setMicEnabled(isMuted); setIsMuted(!isMuted); };
    const toggleCam = () => { room.setCameraEnabled(isCameraOff); setIsCameraOff(!isCameraOff); };

    const handleRaiseHand = async () => {
        const next = !hasRaisedHand;
        setHasRaisedHand(next);
        try {
            await fetch(`/api/v1/meetings/${meetCode}/raise-hand`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ raised: next }),
            });
        } catch { /* ignoré */ }
    };

    const handleGrant = useCallback(async (targetUserId: number, canSpeak: boolean) => {
        setGrantingId(targetUserId);
        try {
            await fetch(`/api/v1/meetings/${meetCode}/grant-speech`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId, canSpeak }),
            });
            setParticipants((prev) =>
                prev.map((p) =>
                    p.userId === targetUserId
                        ? { ...p, canSpeak, raiseHand: false, role: canSpeak ? 'speaker' : 'viewer' }
                        : p
                )
            );
        } catch { /* ignoré */ } finally {
            setGrantingId(null);
        }
    }, [meetCode]);

    // Determine current user's speaker status from participants list
    const myParticipant = participants.find((p) => p.userId === Number(user.id));
    const iAmSpeaker = isHost || myParticipant?.canSpeak || myParticipant?.isHost;

    // Speakers (visible to all in broadcast mode)
    const speakerPeers = peers.filter((p) => {
        const participant = participants.find((pp) => pp.userId === p.userId);
        return !participant || participant.canSpeak || participant.isHost;
    });
    const viewerPeers = peers.filter((p) => {
        const participant = participants.find((pp) => pp.userId === p.userId);
        return participant && !participant.canSpeak && !participant.isHost;
    });

    // Tiles visible — in broadcast: only speakers + self; viewers see speakers only
    const visiblePeers = iAmSpeaker ? peers : speakerPeers;
    const tiles = visiblePeers.length + 1;
    const cols =
        tiles <= 1
            ? 'grid-cols-1'
            : tiles <= 4
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-2 lg:grid-cols-3';

    const raiseHandCount = participants.filter((p) => p.raiseHand).length;

    return (
        <div className="flex flex-col h-[100dvh] bg-[#0b0f1a] text-white overflow-hidden">
            {/* Header */}
            <header className="shrink-0 h-14 flex items-center justify-between px-4 bg-black/40">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-primary/20 px-3 py-1.5 rounded-xl border border-primary/20">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-widest truncate max-w-[100px]">{meetCode}</p>
                    </div>
                    {status === 'joined' && (
                        <Badge variant="outline" className="font-mono border-green-500/30 text-green-500 text-[10px]">
                            {fmt(elapsed)}
                        </Badge>
                    )}
                    <Badge variant="outline" className="text-zinc-300 text-[10px]">
                        <Users className="h-3 w-3 mr-1" />{participants.length || tiles}
                    </Badge>
                    {raiseHandCount > 0 && isHost && (
                        <Badge className="bg-yellow-500 text-black text-[10px] animate-pulse">
                            ✋ {raiseHandCount}
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setShowParticipants((v) => !v)} title="Participants" className="relative h-8 w-8">
                        <Users className="h-4 w-4" />
                        {raiseHandCount > 0 && (
                            <span className="absolute top-0 right-0 h-2 w-2 bg-yellow-400 rounded-full" />
                        )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleCopy} title="Copier le lien" className="h-8 w-8">
                        {copied ? <CheckCheck className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
            </header>

            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Main video area */}
                <main className={cn('flex-1 min-h-0 p-3 grid gap-3 auto-rows-fr', cols)}>
                    {/* Local tile — shown to all but in viewer-only mode it looks like a small badge */}
                    <VideoTile
                        stream={localStream}
                        muted
                        label={`${user.first_name || user.full_name} (vous)`}
                        off={isCameraOff}
                        isMain={isHost}
                        canSpeak={iAmSpeaker}
                        raiseHand={hasRaisedHand}
                    />
                    {visiblePeers.map((p) => {
                        const pData = participants.find((pp) => pp.userId === p.userId);
                        return (
                            <VideoTile
                                key={p.userId}
                                stream={p.stream}
                                label={p.name || `Participant ${p.userId}`}
                                isMain={pData?.isHost || pData?.role === 'speaker'}
                                canSpeak={pData?.canSpeak}
                                raiseHand={pData?.raiseHand}
                            />
                        );
                    })}
                    {/* Viewers count badge (broadcast mode) */}
                    {viewerPeers.length > 0 && iAmSpeaker && (
                        <div className="flex items-center justify-center rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4">
                            <div className="text-center">
                                <p className="text-3xl font-black text-primary">{viewerPeers.length}</p>
                                <p className="text-xs text-zinc-400 mt-1">spectateur{viewerPeers.length > 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    )}
                </main>

                {/* Participants panel */}
                {showParticipants && (
                    <aside className="w-64 shrink-0 bg-zinc-900/90 border-l border-zinc-800 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Participants</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowParticipants(false)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {participants.length === 0 ? (
                                <p className="text-xs text-zinc-500 text-center py-6">Aucun participant visible</p>
                            ) : participants.map((p) => (
                                <div key={p.userId} className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-800/50">
                                    <div className="h-8 w-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold shrink-0">
                                        {(p.name || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{p.name}</p>
                                        <p className="text-[10px] text-zinc-500">
                                            {p.isHost ? '🎙 Hôte' : p.canSpeak ? '🎙 Orateur' : '👁 Spectateur'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {p.raiseHand && <span className="text-sm animate-bounce">✋</span>}
                                        {isHost && !p.isHost && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                disabled={grantingId === p.userId}
                                                title={p.canSpeak ? 'Retirer la parole' : 'Accorder la parole'}
                                                onClick={() => handleGrant(p.userId, !p.canSpeak)}
                                            >
                                                {grantingId === p.userId ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : p.canSpeak ? (
                                                    <VolumeX className="h-3 w-3 text-red-400" />
                                                ) : (
                                                    <Volume2 className="h-3 w-3 text-green-400" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>
                )}
            </div>

            {/* Status messages */}
            {(status === 'connecting' || status === 'media') ? (
                <p className="text-center text-xs text-zinc-400 pb-1 flex items-center justify-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />Connexion…
                </p>
            ) : null}
            {status === 'joined' && peers.length === 0 && (
                <p className="text-center text-xs text-zinc-400 pb-1">En attente de participants. Partagez le lien.</p>
            )}

            {error && (
                <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                    {status === 'error' && (
                        <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={() => join()}>Réessayer</Button>
                    )}
                </div>
            )}

            {/* Controls */}
            <div className="shrink-0 flex items-center justify-center gap-2 sm:gap-3 bg-zinc-900/80 border-t border-white/5 p-3">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleMic}
                    className={cn('h-12 w-12 rounded-full', isMuted ? 'bg-red-500 border-red-500 text-white' : 'bg-zinc-800 text-white')}
                >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleCam}
                    className={cn('h-12 w-12 rounded-full', isCameraOff ? 'bg-red-500 border-red-500 text-white' : 'bg-zinc-800 text-white')}
                >
                    {isCameraOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
                </Button>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={room.toggleScreenShare}
                    className={cn('h-12 w-12 rounded-full hidden sm:inline-flex', isScreenSharing ? 'bg-primary text-white' : 'bg-zinc-800 text-white')}
                    title="Partager l'écran"
                >
                    <Monitor className="h-5 w-5" />
                </Button>

                {/* Raise hand — only for non-host viewers */}
                {!isHost && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleRaiseHand}
                        className={cn(
                            'h-12 w-12 rounded-full',
                            hasRaisedHand ? 'bg-yellow-500 border-yellow-500 text-black' : 'bg-zinc-800 text-white',
                        )}
                        title={hasRaisedHand ? 'Baisser la main' : 'Lever la main'}
                    >
                        <Hand className="h-5 w-5" />
                    </Button>
                )}

                <Button variant="destructive" size="icon" onClick={handleLeave} className="h-12 w-16 rounded-2xl">
                    <PhoneOff className="h-6 w-6" />
                </Button>
            </div>
        </div>
    );
}
