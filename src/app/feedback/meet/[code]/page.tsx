'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Crown, Video as VideoIcon, Mic, MicOff, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MeetInterface } from '@/components/feedback/meet-interface';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { checkMeetingCode } from '@/lib/actions/meeting.actions';
import type { User } from '@/lib/types';

export default function MeetPage() {
    const params = useParams<{ code: string }>();
    const router = useRouter();
    const code = decodeURIComponent(String(params?.code || ''));
    const [user, setUser] = useState<User | null>(null);
    const [state, setState] = useState<'loading' | 'lobby' | 'in' | 'missing' | 'anon'>('loading');
    const [topic, setTopic] = useState('');
    const [withVideo, setWithVideo] = useState(true);
    const [isHost, setIsHost] = useState(false);
    const [participantCount, setParticipantCount] = useState(0);

    useEffect(() => {
        (async () => {
            const [u, m] = await Promise.all([getAuthenticatedUser(), checkMeetingCode(code)]);
            if (!u) return setState('anon');
            setUser(u);
            if (!m.exists) return setState('missing');
            setTopic(m.topic || 'Réunion OnChat');
            setWithVideo(m.type !== 'audio');
            // Détermine si l'utilisateur est le créateur/hôte
            const hostFlag = Number(u.id) === Number(m.hostUserId);
            setIsHost(hostFlag);
            setState('lobby');
        })();
    }, [code]);

    // Charger le nb de participants en attente dans le lobby
    useEffect(() => {
        if (state !== 'lobby') return;
        const load = async () => {
            try {
                const res = await fetch(`/api/v1/meetings/${code}/participants`, { credentials: 'same-origin' });
                const data = await res.json().catch(() => null);
                if (data?.success) setParticipantCount(data.participants?.length || 0);
            } catch { /* ignoré */ }
        };
        load();
        const id = setInterval(load, 5000);
        return () => clearInterval(id);
    }, [state, code]);

    if (state === 'in' && user) {
        return (
            <MeetInterface
                meetCode={code}
                user={user}
                withVideo={withVideo}
                isHost={isHost}
            />
        );
    }

    return (
        <div className="h-[100dvh] flex items-center justify-center bg-[#080c1e] text-white p-6"
            style={{ background: 'radial-gradient(ellipse at 60% 20%, rgba(139,92,246,0.15) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(6,182,212,0.10) 0%, transparent 60%), linear-gradient(160deg, #080c1e 0%, #13072e 50%, #080c1e 100%)' }}>
            <div className="max-w-sm w-full space-y-5">
                {state === 'loading' && (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-[#8b5cf6]" />
                        <p className="text-zinc-400 text-sm">Vérification de la réunion…</p>
                    </div>
                )}

                {state === 'anon' && (
                    <div className="onchat-card rounded-2xl p-6 text-center space-y-4">
                        <p className="text-zinc-300">Connectez-vous à OnChat pour rejoindre cette réunion.</p>
                        <Button className="w-full onchat-btn-primary" onClick={() => router.push('/feedback/login')}>
                            Se connecter
                        </Button>
                    </div>
                )}

                {state === 'missing' && (
                    <div className="onchat-card rounded-2xl p-6 text-center space-y-4">
                        <p className="text-zinc-300">Réunion introuvable ou déjà terminée.</p>
                        <Button variant="outline" className="w-full" onClick={() => router.push('/feedback')}>
                            Retour à OnChat
                        </Button>
                    </div>
                )}

                {state === 'lobby' && (
                    <div className="onchat-card rounded-2xl p-6 space-y-5">
                        {/* Badge hôte ou participant */}
                        <div className="flex items-center justify-between">
                            <div>
                                {isHost ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 rounded-full px-3 py-1">
                                        <Crown className="h-3 w-3" /> Organisateur
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-xs text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 rounded-full px-3 py-1">
                                        Participant
                                    </span>
                                )}
                            </div>
                            {participantCount > 0 && (
                                <span className="text-xs text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/20 rounded-full px-2.5 py-1">
                                    {participantCount} connecté{participantCount > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                        {/* Titre */}
                        <div>
                            <h1 className="text-lg font-bold onchat-gradient-text">{topic}</h1>
                            <p className="text-xs text-zinc-500 mt-1 font-mono">Code : {code}</p>
                        </div>

                        <div className="onchat-divider" />

                        {/* Prévisualisation caméra */}
                        <div>
                            <p className="text-xs text-zinc-400 mb-2">Mode d'entrée :</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setWithVideo(true)}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                                        withVideo
                                            ? 'bg-[#8b5cf6]/20 border-[#8b5cf6]/50 text-[#8b5cf6]'
                                            : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400'
                                    }`}
                                >
                                    <VideoIcon className="h-5 w-5" />
                                    <span className="text-xs font-medium">Avec caméra</span>
                                </button>
                                <button
                                    onClick={() => setWithVideo(false)}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                                        !withVideo
                                            ? 'bg-[#06b6d4]/20 border-[#06b6d4]/50 text-[#06b6d4]'
                                            : 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400'
                                    }`}
                                >
                                    <Mic className="h-5 w-5" />
                                    <span className="text-xs font-medium">Audio seul</span>
                                </button>
                            </div>
                        </div>

                        {/* CTA */}
                        <Button
                            className="w-full onchat-btn-primary h-11"
                            onClick={() => setState('in')}
                        >
                            {isHost ? '🎙 Démarrer la réunion' : 'Rejoindre'}
                        </Button>

                        {isHost && (
                            <p className="text-[10px] text-zinc-500 text-center">
                                En tant qu&apos;organisateur, vous contrôlez la parole, les participants et pouvez terminer la réunion.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
