
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
import { Loader2 } from 'lucide-react';
import { getGoogleOauthUrl } from '@/services/google';
import { Separator } from '@/components/ui/separator';
import { OnChatLogo } from '@/components/feedback/on-chat-logo';

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
            <div className="w-full max-w-md z-10 my-auto">
                 <Skeleton className="h-[400px] w-full rounded-lg" />
            </div>
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
                 router.push('/feedback/login');
                 return;
            }

            const details = await findUserForLogin(searchParams.get('walletId') || '');
            if (!details.success) {
                 openAlert({
                    title: 'Erreur',
                    description: "Impossible de récupérer les informations de l'utilisateur.",
                    variant: 'error',
                    onClose: () => router.push('/feedback/login'),
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
        } else {
            router.push('/feedback/login');
        }

    }, [userIdParam, router, openAlert, searchParams]);

    const handleChannelSelect = async (channel: Channel) => {
        if (!userIdParam) return;
        
        setIsSendingOtp(true);
        const result = await sendOtp(Number(userIdParam), channel);
        setIsSendingOtp(false);

        if (result.success) {
            setSelectedChannel(channel);
            setContact(result.destination);
        } else {
             openAlert({
                title: 'Erreur',
                description: result.error || "Impossible d'envoyer le code.",
                variant: 'error'
            });
        }
    };
    
    if (isLoading || !channelInfo) {
        return <VerifyOtpPageLoading />;
    }
    
    if (selectedChannel && contact && userIdParam) {
        return (
            <main className="flex h-full min-h-screen flex-col items-center justify-center p-8 bg-zinc-900">
                <div className="w-full max-w-md">
                   <OtpForm userId={Number(userIdParam)} contact={contact} channel={selectedChannel} redirectTo="/feedback" />
               </div>
           </main>
        )
    }

    return (
        <main className="flex h-full min-h-screen flex-col items-center justify-center p-8 bg-zinc-900">
            <Card className="bg-card/80 backdrop-blur-sm text-white border-white/10">
                <CardHeader className="items-center text-center">
                    <OnChatLogo className="w-40 mb-4" />
                    <CardTitle className="text-2xl text-white">{t('otpFormTitle')}</CardTitle>
                    <CardDescription className="text-white/80">
                        {t('verifyOtpOnChatDescription')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     {channelInfo.availableChannels.includes('sms') && channelInfo.maskedPhone && (
                        <Button className="w-full" variant="outline" onClick={() => handleChannelSelect('sms')} disabled={isSendingOtp}>
                            {isSendingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <MessageSquare className="mr-2 h-4 w-4" /> {t('sendBySms', { contact: channelInfo.maskedPhone })}
                        </Button>
                     )}
                     {channelInfo.availableChannels.includes('whatsapp') && channelInfo.maskedPhone && (
                        <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleChannelSelect('whatsapp')} disabled={isSendingOtp}>
                            {isSendingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Phone className="mr-2 h-4 w-4" /> {t('sendByWhatsApp', { contact: channelInfo.maskedPhone })}
                        </Button>
                     )}
                     {channelInfo.availableChannels.includes('email') && channelInfo.maskedEmail && (
                        <Button className="w-full" variant="secondary" onClick={() => handleChannelSelect('email')} disabled={isSendingOtp}>
                            {isSendingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Mail className="mr-2 h-4 w-4" /> {t('sendByEmail', { contact: channelInfo.maskedEmail })}
                        </Button>
                     )}
                </CardContent>
            </Card>
        </main>
    );
}


export default function OnChatVerifyOtpPage() {
    return (
        <Suspense fallback={<VerifyOtpPageLoading />}>
            <VerifyOtpPageContent />
        </Suspense>
    )
}
