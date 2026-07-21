

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from "react-i18next";
import { OtpForm } from '@/components/auth/otp-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Mail, MessageSquare, Phone, Chrome, Shield } from 'lucide-react';
import { findUserForLogin, sendOtp } from '@/lib/actions/auth.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Logo } from '@/components/logo';
import { Loader2 } from 'lucide-react';
import { getGoogleOauthUrl } from '@/services/google';
import { Separator } from '../ui/separator';
import Link from 'next/link';
import { LanguageSwitcher } from '../ui/language-switcher';

type Channel = 'sms' | 'email' | 'whatsapp' | 'in-app';

interface ChannelInfo {
    maskedPhone?: string;
    maskedEmail?: string;
    availableChannels: Channel[];
    isGoogleLinked: boolean;
}

function VerifyOtpPageLoading() {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-8 bg-zinc-900">
             <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-br from-[#000e38] to-[#223a7a] rounded-b-[3rem] md:rounded-b-[4rem]" />
            <div className="w-full max-w-md z-10 my-auto">
                <Skeleton className="h-[400px] w-full rounded-lg" />
            </div>
             <footer className="w-full max-w-md z-10 mt-auto py-4">
                <Separator className="my-4 bg-white/20" />
                <p className="text-center text-xs text-white/70">Chargement...</p>
            </footer>
        </main>
    );
}

function VerifyOtpPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const userIdParam = searchParams.get("userId");
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();

    const [isLoading, setIsLoading] = useState(true);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
    const [contact, setContact] = useState<string | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!userIdParam) {
                 router.push('/login');
                 return;
            }

            const details = await findUserForLogin(searchParams.get('walletId') || '');
            if (!details.success) {
                 openAlert({
                    title: 'Erreur',
                    description: "Impossible de récupérer les informations de l'utilisateur.",
                    variant: 'error',
                    onClose: () => router.push('/login'),
                });
            } else {
                 setChannelInfo({
                    maskedPhone: details.maskedPhone,
                    maskedEmail: details.maskedEmail,
                    availableChannels: details.availableChannels,
                    isGoogleLinked: details.isGoogleLinked || false,
                });
            }
            setIsLoading(false);
        };

        if(searchParams.get('walletId')){
            fetchDetails();
        } else if (userIdParam) {
            // This is a fallback if walletId is not in URL, but it should be.
            // A more complete version of findUserForLogin would be needed if we only have userId.
            // For now, we assume walletId is passed for the channel selection flow.
        } else {
            router.push('/login');
        }

    }, [userIdParam, router, openAlert, searchParams]);

    const handleChannelSelect = async (channel: Channel) => {
        if (!userIdParam) return;
        
        if (channel === 'in-app') {
            // Handle authenticator flow directly
            setSelectedChannel(channel);
            setContact('Google Authenticator'); // Placeholder contact
            return;
        }

        setIsSendingOtp(true);
        const result = await sendOtp(Number(userIdParam), channel);
        setIsSendingOtp(false);

        if (result.success) {
            setSelectedChannel(channel);
            setContact(result.destination);
            openAlert({
                title: 'Code envoyé',
                description: `Un code de vérification a été envoyé à votre ${channel === 'email' ? 'adresse email' : 'téléphone'}.`,
                variant: 'success'
            });
        } else {
             openAlert({
                title: 'Erreur',
                description: result.error || "Impossible d'envoyer le code.",
                variant: 'error'
            });
        }
    };
    
    const handleGoogleLogin = async () => {
        const googleUrl = await getGoogleOauthUrl();
        window.location.href = googleUrl;
    };

    if (isLoading || !channelInfo) {
        return <VerifyOtpPageLoading />;
    }
    
    const pageContent = selectedChannel && contact && userIdParam ? (
        <OtpForm userId={Number(userIdParam)} contact={contact} channel={selectedChannel} />
    ) : (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader className="items-center text-center">
                <Logo className="w-40 mb-4" />
                <CardTitle className="text-2xl">Vérification Requise</CardTitle>
                <CardDescription>
                    Choisissez où vous souhaitez recevoir votre code de vérification unique.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {channelInfo.availableChannels.includes('sms') && channelInfo.maskedPhone && (
                    <Button className="w-full" variant="outline" onClick={() => handleChannelSelect('sms')} disabled={isSendingOtp}>
                        {isSendingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <MessageSquare className="mr-2 h-4 w-4" /> Envoyer par SMS à {channelInfo.maskedPhone}
                    </Button>
                )}
                {channelInfo.availableChannels.includes('whatsapp') && channelInfo.maskedPhone && (
                    <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleChannelSelect('whatsapp')} disabled={isSendingOtp}>
                        {isSendingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Phone className="mr-2 h-4 w-4" /> Envoyer par WhatsApp à {channelInfo.maskedPhone}
                    </Button>
                )}
                {channelInfo.availableChannels.includes('email') && channelInfo.maskedEmail && (
                    <Button className="w-full" variant="secondary" onClick={() => handleChannelSelect('email')} disabled={isSendingOtp}>
                        {isSendingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Mail className="mr-2 h-4 w-4" /> Envoyer par Email à {channelInfo.maskedEmail}
                    </Button>
                )}
                {(channelInfo.isGoogleLinked || channelInfo.availableChannels.includes('in-app')) && (
                    <>
                        <div className="flex items-center gap-2">
                            <Separator className="flex-1" />
                            <span className="text-xs text-muted-foreground">OU</span>
                            <Separator className="flex-1" />
                        </div>
                        {channelInfo.isGoogleLinked && (
                            <Button className="w-full bg-white hover:bg-white/90 text-black" onClick={handleGoogleLogin}>
                                <Chrome className="mr-2 h-4 w-4" /> Se connecter avec Google
                            </Button>
                        )}
                         {channelInfo.availableChannels.includes('in-app') && (
                            <Button className="w-full" variant="outline" onClick={() => handleChannelSelect('in-app')}>
                                <Shield className="mr-2 h-4 w-4" /> Utiliser l'application d'authentification
                            </Button>
                         )}
                    </>
                )}
            </CardContent>
        </Card>
    );

    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-8 bg-zinc-900">
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-br from-[#000e38] to-[#223a7a] rounded-b-[3rem] md:rounded-b-[4rem]" />
            <div className="w-full max-w-md z-10 my-auto">
                {pageContent}
            </div>
            <footer className="w-full max-w-md z-10 mt-auto py-4">
                <Separator className="my-4 bg-white/20" />
                <div className="text-center text-xs text-white/70 w-full">
                    <p>{t('copyrightText', { year: new Date().getFullYear() })} {t('copyrightAllRightsReserved')}</p>
                    <div className="mt-2 flex gap-4 justify-center items-center">
                        <Link href="#" className="hover:text-white">{t('loginTermsAndConditions', 'Terms & Conditions')}</Link>
                        <Separator orientation="vertical" className="h-4 bg-white/50" />
                        <Link href="/developer" className="hover:text-white">{t('loginDevelopers', 'Developers')}</Link>
                        <Separator orientation="vertical" className="h-4 bg-white/50" />
                        <LanguageSwitcher />
                    </div>
                </div>
            </footer>
        </main>
    );
}


export default function VerifyOtpPage() {
    return (
        <Suspense fallback={<VerifyOtpPageLoading />}>
            <VerifyOtpPageContent />
        </Suspense>
    )
}
