
'use client';

import React, { useRef, useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { Logo } from '@/components/logo';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Download, ShieldCheck, Wallet, CheckCircle, Loader2, Info, Lock, Globe, Building, User as UserIcon, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { getReceiptLogoBase64 } from '@/lib/actions/transaction.actions';
import { cn } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

/**
 * Helper to generate a simple mock hash for the certificate UI
 */
const generateMockHash = (input: string) => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
};

const CertificateLayout = ({ user, logoBase64 }: { user: User; logoBase64: string | null }) => {
    const creationDate = user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Use stable mock IDs generated on client
    const [certId] = useState(() => Math.random().toString(36).substring(2, 10).toUpperCase());
    const [securityHash] = useState(() => generateMockHash(user.id_wallet || 'CASH_PAY'));

    return (
        <div className="bg-white text-zinc-900 font-sans border-[12px] border-double border-[#000E38]/10 p-10 min-h-[1050px] relative flex flex-col">
            {/* Watermark Logo */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                <img src="/logos/logo.png" alt="" className="w-[500px]" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="space-y-1 text-left">
                    {logoBase64 ? (
                        <img src={logoBase64} alt="CashPay All" className="h-12 w-auto mb-2" />
                    ) : (
                        <h1 className="text-2xl font-black text-[#000E38]">CASH PAY ALL</h1>
                    )}
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#FF6600]">Digital Financial Services & Online Payments</p>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-black uppercase tracking-tighter text-[#000E38]">Certificat d'Enregistrement</h2>
                    <p className="text-xs text-zinc-500 font-bold uppercase">Document Officiel • {creationDate}</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-8 mb-8 relative z-10">
                <div className="col-span-2 space-y-4">
                    <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-left">
                        <h3 className="text-[9px] font-black text-[#000E38]/40 uppercase tracking-widest mb-2 border-b border-zinc-200 pb-1 flex items-center gap-1.5">
                            <UserIcon className="h-3 w-3" /> Informations du Titulaire
                        </h3>
                        <p className="text-xl font-black text-[#000E38] uppercase">{user.full_name}</p>
                        <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                            <div>
                                <p className="text-[8px] font-bold text-zinc-400 uppercase">Profession</p>
                                <p className="font-semibold">{user.profession || 'Utilisateur CashPay'}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-bold text-zinc-400 uppercase">Pays</p>
                                <p className="font-semibold">{user.country}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-[8px] font-bold text-zinc-400 uppercase">Adresse de Résidence</p>
                                <p className="font-semibold">{user.address || 'N/A'}, {user.city || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#000E38]/5 border border-[#000E38]/10 text-left">
                        <h3 className="text-[9px] font-black text-[#000E38]/40 uppercase tracking-widest mb-2 border-b border-[#000E38]/10 pb-1 flex items-center gap-1.5">
                            <Wallet className="h-3 w-3" /> Identification du Compte
                        </h3>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[8px] font-bold text-zinc-400 uppercase">ID Portefeuille Souverain</p>
                                <p className="text-2xl font-black text-[#000E38] font-mono tracking-tighter">{user.id_wallet}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] font-bold text-zinc-400 uppercase">Type de Compte</p>
                                <p className="font-black uppercase text-primary">{user.account_type || 'National'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-span-1 flex flex-col items-center gap-4">
                    <div className="relative h-44 w-full rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-zinc-100 ring-1 ring-zinc-200">
                        {user.profile_photo ? (
                            <img src={user.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center bg-zinc-200 text-zinc-400">PHOTO</div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[9px] font-black uppercase text-green-700 tracking-wider">Actif & Vérifié</span>
                    </div>
                </div>
            </div>

            <div className="space-y-4 text-[9px] leading-relaxed text-zinc-600 relative z-10 flex-1 text-left">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <div>
                            <h4 className="font-black text-[#000E38] uppercase flex items-center gap-1.5 mb-1">
                                <ShieldCheck className="h-3 w-3 text-[#FF6600]" /> Bienvenue dans l'Écosystème
                            </h4>
                            <p>Merci d'avoir rejoint <strong>CashPay All</strong>. Nous nous engageons à soutenir vos activités numériques, paiements et transferts. Notre plateforme est conçue pour vous offrir des solutions financières sécurisées et innovantes.</p>
                        </div>
                        <div>
                            <h4 className="font-black text-[#000E38] uppercase flex items-center gap-1.5 mb-1">
                                <Lock className="h-3 w-3 text-[#FF6600]" /> Informations de Sécurité
                            </h4>
                            <p>Vous êtes seul responsable de la sécurité de vos identifiants. Ne partagez jamais votre code PIN à 4 chiffres ou vos codes OTP avec qui que ce soit, y compris les personnes prétendant être des agents CashPay.</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <h4 className="font-black text-[#000E38] uppercase flex items-center gap-1.5 mb-1">
                                <Info className="h-3 w-3 text-[#FF6600]" /> Institution non bancaire
                            </h4>
                            <p><strong>CashPay All</strong> est un fournisseur de services financiers numériques, <strong>pas une banque</strong>. Nous offrons le traitement des paiements en ligne et la gestion de portefeuilles numériques souverains.</p>
                        </div>
                        <div>
                            <h4 className="font-black text-[#000E38] uppercase flex items-center gap-1.5 mb-1">
                                <Globe className="h-3 w-3 text-[#FF6600]" /> Disponibilité des Services
                            </h4>
                            <p>Votre portefeuille prend en charge les devises internationales (USD, EUR) et les devises locales. Certaines fonctionnalités sont soumises à la disponibilité régionale et au consentement de l'utilisateur.</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                    <h4 className="font-black text-[#000E38] uppercase mb-1 flex items-center gap-1.5">
                        <Building className="h-3 w-3 text-[#FF6600]"/> Protection des Données
                    </h4>
                    <p>Vous restez le propriétaire principal de vos données personnelles. CashPay All traite vos informations avec une confidentialité stricte. Les données ne sont partagées qu'avec des partenaires tiers (banques, émetteurs de cartes) lorsque cela est nécessaire.</p>
                </div>
            </div>

            <div className="mt-8 pt-8 border-t border-zinc-100 grid grid-cols-3 items-end relative z-10 text-left">
                <div className="space-y-4">
                    <div className="h-16 w-32 border-b-2 border-zinc-200 flex items-center justify-center italic text-zinc-300 text-[10px]">Sceau de Conformité</div>
                    <p className="text-[8px] font-black text-zinc-400 uppercase text-left">Bureau de Vérification: FINUSECO SARL</p>
                </div>
                <div className="text-center pb-2">
                    <div className="bg-white p-2 border inline-block rounded-lg shadow-sm mb-1">
                        <QRCodeSVG value={`https://app.cashpay-all.com/verify/${user.id_wallet}`} size={64} />
                    </div>
                    <p className="text-[7px] font-bold text-zinc-400">Scanner pour Vérifier</p>
                </div>
                <div className="text-right space-y-4">
                    {user.signature_image ? (
                        <div className="relative h-16 w-48 ml-auto">
                            <img src={user.signature_image} alt="Signature" className="h-full w-full object-contain" />
                        </div>
                    ) : (
                        <div className="h-16 w-48 border-b-2 border-zinc-200 ml-auto"></div>
                    )}
                    <p className="text-[9px] font-bold uppercase text-[#000E38] text-right">Signature Numérique Autorisée</p>
                </div>
            </div>
            
            <div className="mt-8 text-center border-t pt-4">
                <div className="flex justify-between items-center text-[7px] text-zinc-400 font-bold uppercase tracking-widest px-4">
                    <span>Certificat ID: {certId}</span>
                    <span>Security Hash: {securityHash}</span>
                    <span>FINUSECO SARL • Infrastructure Digitale</span>
                </div>
                <p className="text-[7px] text-zinc-400 mt-2">
                    Ce document sert de preuve de votre identité numérique souveraine au sein du réseau CashPay All. Il est émis électroniquement.
                </p>
            </div>
        </div>
    );
};

export function RegistrationCertificate({ user }: { user: User }) {
    const router = useRouter();
    const [logoBase64, setLogoBase64] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const certificateRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getReceiptLogoBase64().then(setLogoBase64);
    }, []);

    const handleDownloadPdf = async () => {
        const element = certificateRef.current;
        if (!element) return;
        
        setIsGenerating(true);
        try {
            const [html2canvas, { default: jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf')
            ]);
            
            const canvas = await html2canvas.default(element, { 
                scale: 3, 
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            pdf.save(`Certificat_CashPay_${user.id_wallet}.pdf`);
        } catch (error) {
            console.error("PDF generation failed:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-zinc-900 py-10 px-4 flex flex-col items-center">
            {/* Hidden container for A4 capture */}
            <div className="absolute left-[-9999px] top-0">
                <div ref={certificateRef} style={{ width: '210mm', minHeight: '297mm' }}>
                    <CertificateLayout user={user} logoBase64={logoBase64} />
                </div>
            </div>

            <div className="w-full max-w-4xl space-y-8 animate-in fade-in duration-700">
                <div className="text-center space-y-4">
                    <div className="h-20 w-20 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                        <CheckCircle className="h-10 w-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-white uppercase tracking-tight">Compte créé !</h1>
                    <p className="text-zinc-400 max-w-md mx-auto">
                        Bienvenue chez CashPay All. Votre identité numérique souveraine est désormais active.
                    </p>
                </div>
                
                {/* Scrollable Preview on Mobile */}
                <div className="overflow-x-auto pb-4 custom-scrollbar">
                    <div className="min-w-[800px] lg:min-w-0 flex justify-center">
                        <Card className="rounded-3xl overflow-hidden shadow-2xl border-none w-full max-w-[210mm]">
                            <CertificateLayout user={user} logoBase64={logoBase64} />
                        </Card>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                    <Button 
                        onClick={handleDownloadPdf} 
                        variant="outline" 
                        className="h-16 px-10 text-lg font-bold border-white/20 text-white rounded-2xl bg-white/5 hover:bg-white/10" 
                        disabled={isGenerating}
                    >
                        {isGenerating ? <Loader2 className="animate-spin mr-2"/> : <Download className="mr-2"/>} 
                        Télécharger en PDF
                    </Button>
                    <Button 
                        onClick={() => {
                            sessionStorage.setItem('pin-verified-session', 'true');
                            router.push('/dashboard');
                        }} 
                        className="h-16 px-12 text-xl font-black shadow-[0_0_30px_rgba(255,102,0,0.4)] rounded-2xl uppercase tracking-tighter" 
                        variant="gradient"
                    >
                        Commencer <ArrowRight className="ml-2" />
                    </Button>
                </div>
            </div>
            
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { height: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
            `}</style>
        </div>
    );
}
