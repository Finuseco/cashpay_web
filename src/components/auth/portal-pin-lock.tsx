
'use client';

import { useState, useEffect, useRef } from 'react';
import type { User } from '@/lib/types';
import { PinLockForm } from './pin-lock-form';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Loader2, MessageCircle, Video, Phone, Users } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { SplashLogo } from '../splash-logo';
import { OnChatLogo } from '../feedback/on-chat-logo';
import { JojoLogo } from '../shopping/jojo-logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PortalPinLockProps {
    portalName: string;
    children: React.ReactNode;
}

const PIN_LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const PortalLogo = ({ portalName }: { portalName: string }) => {
    if (portalName === 'OnChat') return <OnChatLogo />;
    if (portalName === 'Shopping') return <JojoLogo />;
    return <SplashLogo />;
};

/* ---------------------------------------------------------------
   Avatars fictifs qui "attendent" dans la salle OnChat
   style Zoom lobby / waiting room
---------------------------------------------------------------- */
const WAITING_USERS = [
    { name: 'Amani K.',   initials: 'AK', color: '#8b5cf6', x: 18, y: 22, size: 56, delay: 0 },
    { name: 'Brice M.',   initials: 'BM', color: '#06b6d4', x: 72, y: 15, size: 48, delay: 0.4 },
    { name: 'Cynthia P.', initials: 'CP', color: '#9333ea', x: 10, y: 60, size: 44, delay: 0.9 },
    { name: 'David L.',   initials: 'DL', color: '#0891b2', x: 80, y: 55, size: 52, delay: 0.2 },
    { name: 'Eva R.',     initials: 'ER', color: '#7c3aed', x: 55, y: 72, size: 40, delay: 1.1 },
    { name: 'Fiston N.',  initials: 'FN', color: '#22d3ee', x: 42, y: 12, size: 36, delay: 0.6 },
    { name: 'Grace T.',   initials: 'GT', color: '#a78bfa', x: 85, y: 28, size: 38, delay: 1.3 },
    { name: 'Henry O.',   initials: 'HO', color: '#0e7490', x: 28, y: 80, size: 42, delay: 0.8 },
];

const PARTICLES = [
    { x: 15, y: 30, color: '#8b5cf6', delay: 0 },
    { x: 60, y: 8,  color: '#06b6d4', delay: 0.7 },
    { x: 88, y: 42, color: '#9333ea', delay: 1.4 },
    { x: 35, y: 90, color: '#22d3ee', delay: 0.3 },
    { x: 75, y: 85, color: '#8b5cf6', delay: 1.0 },
    { x: 5,  y: 70, color: '#06b6d4', delay: 1.8 },
    { x: 50, y: 45, color: '#a78bfa', delay: 0.5 },
    { x: 92, y: 12, color: '#0891b2', delay: 2.1 },
];

/** Salle d'attente OnChat style Zoom, uniquement pour la page PIN OnChat */
function OnChatWaitingRoom() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            {/* Dégradé de fond radial */}
            <div className="absolute inset-0"
                style={{
                    background: 'radial-gradient(ellipse 90% 70% at 50% 45%, rgba(139,92,246,0.22) 0%, transparent 65%), radial-gradient(ellipse 60% 50% at 75% 75%, rgba(6,182,212,0.12) 0%, transparent 55%), linear-gradient(155deg,#080c1e 0%,#13072e 50%,#080c1e 100%)'
                }}
            />

            {/* Cercles flottants décoratifs (icônes, comme sur le splash) */}
            <div className="absolute"
                style={{ left: '8%', top: '38%', animation: 'oc-float 6s ease-in-out infinite' }}>
                <div className="onchat-icon-ring-cyan w-12 h-12">
                    <MessageCircle size={20} />
                </div>
            </div>
            <div className="absolute"
                style={{ right: '7%', top: '32%', animation: 'oc-float 7s ease-in-out infinite 1s' }}>
                <div className="onchat-icon-ring-violet w-11 h-11">
                    <Video size={18} />
                </div>
            </div>
            <div className="absolute"
                style={{ left: '18%', bottom: '22%', animation: 'oc-float 5.5s ease-in-out infinite 0.5s' }}>
                <div className="onchat-icon-ring-cyan w-9 h-9">
                    <Phone size={15} />
                </div>
            </div>
            <div className="absolute"
                style={{ right: '14%', bottom: '18%', animation: 'oc-float 8s ease-in-out infinite 1.5s' }}>
                <div className="onchat-icon-ring-violet w-10 h-10">
                    <Users size={16} />
                </div>
            </div>

            {/* Avatars flottants (salle d'attente Zoom) */}
            {WAITING_USERS.map((u) => (
                <div key={u.name}
                    className="absolute"
                    style={{
                        left: `${u.x}%`,
                        top: `${u.y}%`,
                        animation: `oc-float ${5 + u.delay * 2}s ease-in-out infinite ${u.delay}s`,
                    }}>
                    <div className="relative">
                        {/* Halo coloré autour de l'avatar */}
                        <div className="absolute inset-0 rounded-full blur-md opacity-50"
                            style={{ backgroundColor: u.color, transform: 'scale(1.3)' }} />
                        <Avatar style={{ width: u.size, height: u.size }} className="relative border-2" style2={{ borderColor: u.color }}>
                            <AvatarFallback
                                className="text-white font-bold text-xs"
                                style={{ backgroundColor: u.color, fontSize: u.size * 0.27 }}>
                                {u.initials}
                            </AvatarFallback>
                        </Avatar>
                        {/* Indicateur en ligne */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#080c1e]"
                            style={{ backgroundColor: '#22c55e' }} />
                    </div>
                </div>
            ))}

            {/* Particules scintillantes */}
            {PARTICLES.map((p, i) => (
                <div key={i}
                    className="absolute onchat-particle"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        backgroundColor: p.color,
                        animationDelay: `${p.delay}s`,
                    }} />
            ))}

            {/* Lignes de connexion (SVG subtil) */}
            <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="18" y1="22" x2="42" y2="12" stroke="#8b5cf6" strokeWidth="0.3" />
                <line x1="72" y1="15" x2="85" y2="28" stroke="#06b6d4" strokeWidth="0.3" />
                <line x1="80" y1="55" x2="55" y2="72" stroke="#9333ea" strokeWidth="0.3" />
                <line x1="10" y1="60" x2="28" y2="80" stroke="#06b6d4" strokeWidth="0.3" />
                <line x1="42" y1="12" x2="72" y2="15" stroke="#8b5cf6" strokeWidth="0.2" />
                <line x1="18" y1="22" x2="10" y2="60" stroke="#a78bfa" strokeWidth="0.2" />
            </svg>
        </div>
    );
}

export function PortalPinLock({ portalName, children }: PortalPinLockProps) {
    const [user, setUser] = useState<User | null>(null);
    const [isLocked, setIsLocked] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const pathname = usePathname();
    const router = useRouter();
    const isOnChat = portalName === 'OnChat';

    useEffect(() => {
        const checkAuthAndLockState = async () => {
            setIsLoading(true);
            const fetchedUser = await getAuthenticatedUser();

            if (!fetchedUser) {
                router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
                return;
            }
            setUser(fetchedUser);

            const lockInfoRaw = sessionStorage.getItem(`${portalName}-lock`);
            if (lockInfoRaw) {
                try {
                    const lockInfo = JSON.parse(lockInfoRaw);
                    const timeSinceUnlock = Date.now() - lockInfo.timestamp;
                    if (timeSinceUnlock < PIN_LOCK_TIMEOUT_MS) {
                        setIsLocked(false);
                    }
                } catch (e) {
                    console.error("Failed to parse lock info from sessionStorage", e);
                }
            }
            setIsLoading(false);
        };
        checkAuthAndLockState();
    }, [portalName, pathname, router]);

    const handleUnlockSuccess = () => {
        try {
            const lockInfo = { unlocked: true, timestamp: Date.now() };
            sessionStorage.setItem(`${portalName}-lock`, JSON.stringify(lockInfo));
            setIsLocked(false);
        } catch (e) {
            console.error("Failed to set lock info in sessionStorage", e);
            setIsLocked(false);
        }
    };

    /* ---- Loading splash ---- */
    if (isLoading || !user) {
        if (isOnChat) {
            return (
                <div className="relative flex flex-col items-center justify-center h-screen overflow-hidden">
                    <div className="absolute inset-0"
                        style={{ background: 'linear-gradient(155deg,#080c1e 0%,#13072e 50%,#080c1e 100%)' }} />
                    <OnChatWaitingRoom />
                    <div className="relative z-10 flex flex-col items-center gap-6">
                        <PortalLogo portalName={portalName} />
                        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                        <p className="text-sm text-white/50">Connexion en cours…</p>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-zinc-900 text-white">
                <PortalLogo portalName={portalName} />
                <Loader2 className="mt-8 h-8 w-8 animate-spin" />
            </div>
        );
    }

    /* ---- PIN lock screen ---- */
    if (isLocked) {
        if (isOnChat) {
            return (
                <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
                    {/* Fond + avatars salle d'attente */}
                    <OnChatWaitingRoom />

                    {/* Texte d'ambiance en haut */}
                    <div className="relative z-10 w-full text-center pt-10 pb-2">
                        <p className="text-white/40 text-xs tracking-widest uppercase">
                            {WAITING_USERS.length} personnes en ligne
                        </p>
                    </div>

                    {/* Carte PIN centrale glassmorphism */}
                    <div className="relative z-10 w-full max-w-sm mx-4 my-auto">
                        {/* Halo derrière la carte */}
                        <div className="absolute -inset-4 rounded-3xl blur-2xl opacity-30"
                            style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }} />

                        <div className="relative onchat-card p-6">
                            {/* Logo OnChat en haut de la carte */}
                            <div className="flex justify-center mb-4">
                                <PortalLogo portalName={portalName} />
                            </div>

                            {/* Titre dégradé */}
                            <h2 className="onchat-gradient-text text-center text-xl font-bold mb-1">
                                Bienvenue sur OnChat
                            </h2>
                            <p className="text-center text-white/50 text-xs mb-5">
                                Entrez votre code PIN pour accéder à vos conversations
                            </p>

                            {/* Divider dégradé */}
                            <div className="onchat-divider mb-5" />

                            {/* Formulaire PIN */}
                            <PinLockForm user={user} onSuccess={handleUnlockSuccess} portalLogo={null} />
                        </div>
                    </div>

                    {/* Badge "Integrated with Finisco SARL" en bas */}
                    <div className="relative z-10 pb-8 text-white/25 text-xs text-center">
                        Integrated with Finisco SARL
                    </div>
                </main>
            );
        }

        /* Autres portails (Shopping, etc.) — design inchangé */
        return (
            <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-8 bg-zinc-900">
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-br from-[#000e38] to-[#223a7a] rounded-b-[3rem] md:rounded-b-[4rem]" />
                <div className="w-full max-w-md z-10 my-auto">
                    <PinLockForm user={user} onSuccess={handleUnlockSuccess} portalLogo={<PortalLogo portalName={portalName} />} />
                </div>
            </main>
        );
    }

    return <>{children}</>;
}
