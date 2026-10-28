
'use client';

import { useTranslation } from "react-i18next";
import Link from 'next/link';
import { MessageCircle, Video, ArrowRight, Send, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OnChatLandingPage() {
    const { t } = useTranslation();
    return (
        <div className="relative flex items-center justify-center min-h-screen overflow-hidden p-4 onchat-bg">
            {/* Halos décoratifs */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
            <div className="absolute bottom-1/4 right-10 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #06b6d4, transparent)' }} />

            {/* Cercles icône flottants (style splash Android) */}
            <div className="absolute left-[8%] top-[35%] onchat-icon-ring-cyan w-14 h-14"
                style={{ animation: 'oc-float 6s ease-in-out infinite' }}>
                <MessageCircle size={22} />
            </div>
            <div className="absolute right-[7%] top-[30%] onchat-icon-ring-violet w-12 h-12"
                style={{ animation: 'oc-float 7s ease-in-out infinite 1s' }}>
                <Video size={20} />
            </div>
            <div className="absolute right-[12%] bottom-[28%] onchat-icon-ring-cyan w-10 h-10"
                style={{ animation: 'oc-float 5s ease-in-out infinite 0.5s' }}>
                <Send size={16} />
            </div>

            {/* Carte principale */}
            <div className="relative w-full max-w-sm z-10">
                {/* Halo derrière la carte */}
                <div className="absolute -inset-3 rounded-3xl blur-2xl opacity-25 pointer-events-none"
                    style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }} />

                <div className="relative onchat-card p-6 space-y-6">
                    {/* Logo + titre */}
                    <div className="text-center space-y-3">
                        <div className="flex justify-center">
                            <div className="w-20 h-20 rounded-2xl flex items-center justify-center onchat-pulse"
                                style={{ background: 'linear-gradient(135deg,#7c3aed,#8b5cf6,#06b6d4)', boxShadow: '0 8px 32px rgba(139,92,246,0.5)' }}>
                                <MessageCircle className="w-10 h-10 text-white" />
                            </div>
                        </div>
                        <h1 className="onchat-gradient-text text-3xl font-extrabold tracking-tight">
                            OnChat
                        </h1>
                        <div className="onchat-pill text-center mx-auto w-fit">
                            Écosystème CashPay • Messagerie &amp; Transferts
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="onchat-divider" />

                    {/* Features */}
                    <ul className="space-y-3">
                        {[
                            { icon: Shield, text: t('onChatFeature1', 'Chattez en toute sécurité avec vos contacts CashPay.'), color: '#8b5cf6' },
                            { icon: Send,   text: t('onChatFeature2', 'Envoyez de l\'argent directement dans la conversation.'), color: '#06b6d4' },
                            { icon: Video,  text: t('onChatFeature3', 'Passez des appels audio et vidéo HD.'), color: '#9333ea' },
                            { icon: Zap,    text: t('onChatFeature4', 'Organisez des meetings payants ou gratuits.'), color: '#22d3ee' },
                        ].map(({ icon: Icon, text, color }) => (
                            <li key={text} className="flex items-start gap-3 text-sm text-white/80">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${color}22`, border: `1px solid ${color}55` }}>
                                    <Icon size={13} style={{ color }} />
                                </div>
                                {text}
                            </li>
                        ))}
                    </ul>

                    {/* Divider */}
                    <div className="onchat-divider" />

                    {/* CTA buttons */}
                    <div className="space-y-3">
                        <Button asChild className="w-full onchat-btn-primary font-bold rounded-xl h-11">
                            <Link href="/register">
                                {t('onChatJoinButton', 'Rejoindre CashPay')}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button asChild variant="ghost"
                            className="w-full border rounded-xl h-11 text-white/80 hover:text-white hover:bg-white/5"
                            style={{ borderColor: 'rgba(139,92,246,0.35)' }}>
                            <Link href="/feedback/login">
                                {t('onChatConnectButton', 'Connecter mon compte existant')}
                            </Link>
                        </Button>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-white/25 text-xs">
                        Integrated with Finisco SARL
                    </p>
                </div>
            </div>
        </div>
    );
}
