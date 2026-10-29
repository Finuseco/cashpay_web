'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Users,
    ShieldCheck, Copy, Monitor, AlertTriangle, Loader2,
    Hand, CheckCheck, X, Crown, Volume2, VolumeX,
    MicOff as MuteAll, UserX, LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

/** Tuile vidéo d'un participant — affiche l'avatar réel si la caméra est off */
function VideoTile({
    stream, muted, label, avatar, off, isMain, raiseHand, canSpeak, isHostTile,
}: {
    stream: MediaStream | null;
    muted?: boolean;
    label: string;
    avatar?: string | null;
    off?: boolean;
    isMain?: boolean;
    raiseHand?: boolean;
    canSpeak?: boolean;
    isHostTile?: boolean;
}) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
    }, [stream]);

    const initials = label
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

    return (
        <div className={cn(
            'relative rounded-2xl bg-zinc-900 border overflow-hidden min-h-0 min-w-0',
            isMain
                ? 'border-[#8b5cf6]/60 ring-2 ring-[#8b5cf6]/30'
                : isHostTile
                ? 'border-[#06b6d4]/40 ring-1 ring-[#06b6d4]/20'
                : 'border-zinc-800/50',
        )}>
            <video ref={ref} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />

            {/* Avatar quand caméra off */}
            {(off || !stream) && (
                <div className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #13072e 0%, #0b0f1a 100%)' }}>
                    {avatar ? (
                        <img
                            src={avatar}
                            alt={label}
                            className="h-20 w-20 rounded-full object-cover ring-4"
                            style={{ outlineColor: isHostTile ? '#06b6d4' : '#8b5cf6' }}
                        />
                    ) : (
                        <div className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-black ring-4"
                            style={{
                                background: isHostTile
                                    ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
                                    : 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                                outlineColor: isHostTile ? '#06b6d4' : '#8b5cf6',
                            }}>
                            {initials || '?'}
                        </div>
                    )}
                </div>
            )}

            {/* Labels bas */}
            <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 flex items-center justify-between"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
                <span className="text-xs font-medium truncate max-w-[70%] drop-shadow">{label}</span>
                <div className="flex items-center gap-1">
                    {isHostTile && <Crown className="h-3 w-3 text-[#06b6d4]" />}
                    {raiseHand && (
                        <span className="text-xs bg-yellow-500/80 rounded-full px-1.5 py-0.5 animate-bounce">✋</span>
                    )}
                    {canSpeak && !raiseHand && !isHostTile && (
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
    const [showParticipants, setShowParticipants] = useState(isHost);
    const [participants, setParticipants] = useState<LiveParticipant[]>([]);
    const [revenue, setRevenue] = useState<{ currency: string; amount: number; payments: number }[]>([]);
    const [actionError, setActionError] = useState('');
    const [tariff, setTariff] = useState('0');
    const [tariffCurrency, setTariffCurrency] = useState('USD');
    const [savingTariff, setSavingTariff] = useState(false);
    const [actionSuccess, setActionSuccess] = useState('');
    const [hasRaisedHand, setHasRaisedHand] = useState(false);
    const [grantingId, setGrantingId] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const [isEndingMeeting, setIsEndingMeeting] = useState(false);
    const room = useMeetRoom(meetCode, withVideo);
    const { status, error, peers, localStream, isScreenSharing, join, leave } = room;

    useEffect(() => {
        if (!isHost) return;
        fetch(`/api/v1/meetings/${meetCode}/billing`, { cache: 'no-store' }).then(async response => {
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Tarif indisponible.');
            setTariff(String(data.billing.priceAmount)); setTariffCurrency(data.billing.priceCurrency);
        }).catch(error => setActionError(error.message));
    }, [isHost, meetCode]);
    async function saveTariff() {
        setSavingTariff(true); setActionError(''); setActionSuccess('');
        try {
            const response = await fetch(`/api/v1/meetings/${meetCode}/billing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priceAmount: Number(tariff), priceCurrency: tariffCurrency }) });
            const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || 'Modification refusée.');
            setActionSuccess('Tarif enregistré pour les prochaines participations.');
        } catch (error) { setActionError((error as Error).message); } finally { setSavingTariff(false); }
    }
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
                if (!res.ok || !data?.success) throw new Error(data?.error || 'Participants indisponibles.');
                setParticipants(data.participants || []);
                setRevenue(data.revenue || []);
            } catch (error) { setActionError((error as Error).message); }
        };
        const update = (event: Event) => { if ((event as CustomEvent).detail?.meetCode === meetCode) load(); };
        window.addEventListener('onchat-meeting-updated', update);
        load();
        const id = setInterval(load, 8000);
        return () => { clearInterval(id); window.removeEventListener('onchat-meeting-updated', update); };
    }, [status, meetCode]);

    const fmt = (s: number) =>
        [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
            .map((v) => String(v).padStart(2, '0'))
            .join(':');

    const handleLeave = () => { leave(); router.push('/feedback'); };

    /** Terminer la réunion pour tous (hôte uniquement) */
    const handleEndMeeting = async () => {
        if (!isHost) return;
        setIsEndingMeeting(true);
        try {
            const response = await fetch(`/api/v1/meetings/${meetCode}/end`, {
                method: 'POST',
                credentials: 'same-origin',
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Action refusée.');
            handleLeave();
        } catch (error) { setActionError((error as Error).message); } finally { setIsEndingMeeting(false); }
    };

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
            const response = await fetch(`/api/v1/meetings/${meetCode}/raise-hand`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ raised: next }),
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Demande refusée.');
        } catch (error) { setHasRaisedHand(!next); setActionError((error as Error).message); }
    };

    const handleGrant = useCallback(async (targetUserId: number, canSpeak: boolean) => {
        setGrantingId(targetUserId);
        try {
            setActionError('');
            const response = await fetch(`/api/v1/meetings/${meetCode}/grant-speech`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId, canSpeak }),
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Action refusée.');
            setParticipants((prev) =>
                prev.map((p) =>
                    p.userId === targetUserId
                        ? { ...p, canSpeak, raiseHand: false, role: canSpeak ? 'speaker' : 'viewer' }
                        : p
                )
            );
        } catch (error) { setActionError((error as Error).message); } finally {
            setGrantingId(null);
        }
    }, [meetCode]);

    /** Mute all — hôte uniquement */
    const handleMuteAll = useCallback(async () => {
        try {
            const response = await fetch(`/api/v1/meetings/${meetCode}/mute-all`, {
                method: 'POST',
                credentials: 'same-origin',
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Action refusée.');
        } catch (error) { setActionError((error as Error).message); }
    }, [meetCode]);

    /** Expulser un participant — hôte uniquement */
    const handleKick = useCallback(async (targetUserId: number) => {
        try {
            const response = await fetch(`/api/v1/meetings/${meetCode}/kick`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId }),
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.error || 'Action refusée.');
            setParticipants((prev) => prev.filter((p) => p.userId !== targetUserId));
        } catch (error) { setActionError((error as Error).message); }
    }, [meetCode]);

    const myParticipant = participants.find((p) => p.userId === Number(user.id));
    const iAmSpeaker = room.canSpeak;

    const speakerPeers = peers.filter((p) => {
        const participant = participants.find((pp) => pp.userId === p.userId);
        return Boolean(participant && (participant.canSpeak || participant.isHost));
    });
    const viewerPeers = peers.filter((p) => {
        const participant = participants.find((pp) => pp.userId === p.userId);
        return participant && !participant.canSpeak && !participant.isHost;
    });

    const visiblePeers = iAmSpeaker ? peers : speakerPeers;
    const tiles = visiblePeers.length + 1;
    const cols =
        tiles <= 1 ? 'grid-cols-1'
        : tiles <= 4 ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-2 lg:grid-cols-3';

    const raiseHandCount = participants.filter((p) => p.raiseHand).length;

    const userAvatar = (user as any).photo_url || (user as any).avatar || null;

    return (
        <div className="relative flex flex-col h-[100dvh] text-white overflow-hidden" style={{ background: 'linear-gradient(160deg, #080c1e 0%, #13072e 50%, #080c1e 100%)' }}>
            {/* Header */}
            <header className="shrink-0 h-14 flex items-center justify-between px-4 bg-black/40">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    {/* Code réunion */}
                    <div className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5"
                        style={{ background: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.25)' }}>
                        <ShieldCheck className="h-3.5 w-3.5 text-[#8b5cf6]" />
                        <p className="text-[10px] font-black uppercase tracking-widest truncate max-w-[100px] text-[#8b5cf6]">{meetCode}</p>
                    </div>

                    {/* Timer */}
                    {status === 'joined' && (
                        <Badge variant="outline" className="font-mono border-green-500/30 text-green-400 text-[10px]">
                            {fmt(elapsed)}
                        </Badge>
                    )}

                    {/* Participants count */}
                    <Badge variant="outline" className="text-zinc-300 text-[10px] border-zinc-700/40">
                        <Users className="h-3 w-3 mr-1" />{participants.length || tiles}
                    </Badge>

                    {/* Badge hôte */}
                    {isHost && (
                        <Badge className="text-[10px] gap-1"
                            style={{ background: 'linear-gradient(90deg, #7c3aed, #8b5cf6)', border: 'none' }}>
                            <Crown className="h-2.5 w-2.5" /> Organisateur
                        </Badge>
                    )}

                    {/* Mains levées — alerte hôte */}
                    {raiseHandCount > 0 && isHost && (
                        <Badge className="bg-yellow-500 text-black text-[10px] animate-pulse">
                            ✋ {raiseHandCount}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setShowParticipants((v) => !v)} title="Participants" className="relative h-8 w-8">
                        <Users className="h-4 w-4" />
                        {raiseHandCount > 0 && isHost && (
                            <span className="absolute top-0 right-0 h-2 w-2 bg-yellow-400 rounded-full" />
                        )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleCopy} title="Copier le lien" className="h-8 w-8">
                        {copied ? <CheckCheck className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
            </header>

            {/* ── Body ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Zone vidéo principale */}
                <main className={cn('flex-1 min-h-0 p-3 grid gap-3 auto-rows-fr', cols)}>
                    {/* Tuile locale */}
                    <VideoTile
                        stream={localStream}
                        muted
                        label={`${user.first_name || user.full_name} (vous)`}
                        avatar={userAvatar}
                        off={isCameraOff}
                        isMain={isHost}
                        isHostTile={isHost}
                        canSpeak={iAmSpeaker}
                        raiseHand={hasRaisedHand}
                    />
                    {/* Tuiles distantes */}
                    {visiblePeers.map((p) => {
                        const pData = participants.find((pp) => pp.userId === p.userId);
                        return (
                            <VideoTile
                                key={p.userId}
                                stream={p.stream}
                                label={p.name || `Participant ${p.userId}`}
                                avatar={pData?.avatar}
                                isMain={pData?.isHost || pData?.role === 'speaker'}
                                isHostTile={pData?.isHost}
                                canSpeak={pData?.canSpeak}
                                raiseHand={pData?.raiseHand}
                            />
                        );
                    })}
                    {/* Compteur spectateurs */}
                    {viewerPeers.length > 0 && iAmSpeaker && (
                        <div className="flex items-center justify-center rounded-2xl border p-4"
                            style={{ background: 'rgba(19,7,62,0.45)', borderColor: 'rgba(139,92,246,0.2)' }}>
                            <div className="text-center">
                                <p className="text-3xl font-black text-[#8b5cf6]">{viewerPeers.length}</p>
                                <p className="text-xs text-zinc-400 mt-1">spectateur{viewerPeers.length > 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    )}
                </main>

                {/* ── Panel participants ── */}
                {showParticipants && (
                    <aside className="absolute top-14 bottom-20 right-0 z-20 w-full sm:static sm:w-80 shrink-0 bg-zinc-900/90 border-l border-zinc-800 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Participants</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowParticipants(false)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                        {isHost && <div className="p-3 border-b border-border space-y-2"><h3 className="font-semibold text-sm">Administration de la réunion</h3><div className="grid grid-cols-2 gap-2"><div><Label htmlFor="host-tariff">Tarif futur</Label><Input id="host-tariff" type="number" min="0" step="0.01" value={tariff} onChange={event => setTariff(event.target.value)} /></div><div><Label htmlFor="host-currency">Devise</Label><Input id="host-currency" maxLength={10} value={tariffCurrency} onChange={event => setTariffCurrency(event.target.value.toUpperCase())} /></div></div><Button size="sm" disabled={savingTariff} onClick={saveTariff}>Enregistrer le tarif</Button><p className="text-xs text-muted-foreground">Revenus bruts reçus, hors frais payés par les participants</p>{revenue.length ? revenue.map(row => <p key={row.currency} className="font-semibold text-secondary">{row.amount} {row.currency} <span className="text-xs text-muted-foreground">· {row.payments} paiement(s)</span></p>) : <p className="text-xs text-muted-foreground">Aucun paiement enregistré.</p>}<Button variant="destructive" size="sm" onClick={async () => {
                            setActionError('');
                            try { const response = await fetch(`/api/v1/meetings/${meetCode}/end`, { method: 'POST' }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || 'Action refusée.'); handleLeave(); }
                            catch (error) { setActionError((error as Error).message); }
                        }}>Terminer pour tous</Button></div>}
                        {isHost && <div className="px-3 py-2 border-b border-border"><Button size="sm" variant="outline" onClick={handleMuteAll}><MuteAll className="h-3 w-3 mr-2" />Couper tous les micros</Button></div>}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {participants.length === 0 ? (
                                <p className="text-xs text-zinc-500 text-center py-6">Aucun participant visible</p>
                            ) : participants.map((p) => (
                                <div key={p.userId}
                                    className="flex items-center gap-2 p-2 rounded-xl hover:bg-zinc-800/40 transition-colors">
                                    {/* Avatar participant */}
                                    <div className="h-9 w-9 rounded-full overflow-hidden shrink-0 ring-2"
                                        style={{ outlineColor: p.isHost ? '#06b6d4' : 'rgba(139,92,246,0.3)' }}>
                                        {p.avatar ? (
                                            <img src={p.avatar} alt={p.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-sm font-bold"
                                                style={{
                                                    background: p.isHost
                                                        ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
                                                        : 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                                                }}>
                                                {(p.name || '?')[0].toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">{p.name}</p>
                                        <p className="text-[10px] text-zinc-500">
                                            {p.isHost ? '👑 Hôte' : p.canSpeak ? '🎙 Orateur' : '👁 Spectateur'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {p.raiseHand && <span className="text-sm animate-bounce">✋</span>}
                                        {isHost && p.raiseHand && !p.isHost && <><Button size="sm" variant="ghost" disabled={grantingId === p.userId} onClick={() => handleGrant(p.userId, true)}>Accepter</Button><Button size="sm" variant="ghost" disabled={grantingId === p.userId} onClick={() => handleGrant(p.userId, false)}>Refuser</Button></>}
                                        {isHost && !p.isHost && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    disabled={grantingId === p.userId}
                                                    title={p.canSpeak ? 'Couper le micro' : 'Accorder la parole'}
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
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    title="Expulser"
                                                    onClick={() => handleKick(p.userId)}
                                                >
                                                    <UserX className="h-3 w-3 text-red-500/70 hover:text-red-400" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>
                )}
            </div>

            {actionSuccess && <p role="status" className="text-sm text-secondary px-4 py-2">{actionSuccess}</p>}
            {actionError && <p role="alert" className="text-sm text-red-400 px-4 py-2">{actionError}</p>}
            {/* Status messages */}
            {(status === 'connecting' || status === 'media') && (
                <p className="text-center text-xs text-zinc-400 pb-1 flex items-center justify-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin text-[#8b5cf6]" />Connexion…
                </p>
            )}
            {status === 'joined' && peers.length === 0 && (
                <p className="text-center text-xs text-zinc-400 pb-1">
                    {isHost ? 'En attente de participants. Partagez le lien.' : 'En attente…'}
                </p>
            )}

            {error && (
                <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                    {status === 'error' && (
                        <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={() => join()}>Réessayer</Button>
                    )}
                </div>
            )}

            {!iAmSpeaker && status === 'joined' && <p className="text-center text-xs text-muted-foreground p-2">Vous êtes spectateur. Levez la main pour demander à rejoindre la scène.</p>}
            {/* Controls */}
            <div className="shrink-0 flex items-center justify-center gap-2 sm:gap-3 bg-zinc-900/80 border-t border-white/5 p-3">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleMic}
                    disabled={!iAmSpeaker}
                    className={cn('h-12 w-12 rounded-full', isMuted ? 'bg-red-500 border-red-500 text-white' : 'bg-zinc-800 text-white')}
                >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>

                {/* Caméra */}
                <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleCam}
                    disabled={!iAmSpeaker}
                    className={cn('h-12 w-12 rounded-full', isCameraOff ? 'bg-red-500 border-red-500 text-white' : 'bg-zinc-800 text-white')}
                >
                    {isCameraOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
                </Button>

                {/* Partage d'écran */}
                <Button
                    variant="outline"
                    size="icon"
                    onClick={room.toggleScreenShare}
                    disabled={!iAmSpeaker}
                    className={cn('h-12 w-12 rounded-full hidden sm:inline-flex', isScreenSharing ? 'bg-primary text-white' : 'bg-zinc-800 text-white')}
                    title="Partager l'écran"
                >
                    <Monitor className="h-5 w-5" />
                </Button>

                {/* Lever la main — participants seulement */}
                {!isHost && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleRaiseHand}
                        className={cn(
                            'h-12 w-12 rounded-full',
                            hasRaisedHand ? 'bg-yellow-500 border-yellow-500 text-black' : 'bg-zinc-800/80 text-white border-zinc-700/50',
                        )}
                        title={hasRaisedHand ? 'Baisser la main' : 'Lever la main'}
                    >
                        <Hand className="h-5 w-5" />
                    </Button>
                )}

                {/* Séparateur visuel avant quitter/terminer */}
                <div className="h-8 w-px bg-zinc-700/40 hidden sm:block" />

                {/* Hôte : Terminer la réunion pour tous */}
                {isHost ? (
                    <Button
                        disabled={isEndingMeeting}
                        onClick={handleEndMeeting}
                        className="h-12 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white border-0 gap-2"
                    >
                        {isEndingMeeting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <PhoneOff className="h-5 w-5" />
                        )}
                        <span className="hidden sm:inline text-sm font-medium">Terminer</span>
                    </Button>
                ) : (
                    /* Participant : Quitter seulement */
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={handleLeave}
                        className="h-12 w-14 rounded-2xl"
                        title="Quitter la réunion"
                    >
                        <LogOut className="h-5 w-5" />
                    </Button>
                )}
            </div>
        </div>
    );
}
