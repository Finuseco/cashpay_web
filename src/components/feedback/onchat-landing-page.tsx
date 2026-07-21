
'use client';

import { useTranslation } from "react-i18next";
import NextImage from 'next/image';
import Link from 'next/link';
import { MessageCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OnChatLandingPage() {
    const { t } = useTranslation();
    return (
        <div className="flex items-center justify-center min-h-screen bg-zinc-900 p-4">
            <Card className="w-full max-w-md bg-zinc-800/80 backdrop-blur-sm text-white border-white/10">
                <CardHeader className="text-center">
                    <MessageCircle className="h-12 w-12 mx-auto text-primary mb-4" />
                    <CardTitle className="text-2xl text-white">{t('onChatLandingTitle', 'Welcome to OnChat')}</CardTitle>
                    <CardDescription className="text-white/80">
                        {t('onChatLandingDescription', 'Communicate, share, and transfer money, all in one place.')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative aspect-video rounded-lg overflow-hidden">
                         <NextImage 
                            src="/images/login/onchat-landing.png"
                            alt={t('onChatLandingImageAlt', 'Smiling person chatting on their phone')}
                            width={600}
                            height={400}
                            className="bg-muted w-full h-auto"
                            data-ai-hint="bamboo forest"
                        />
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-white/90">
                        <li>{t('onChatFeature1', 'Chat securely with your CashPay contacts.')}</li>
                        <li>{t('onChatFeature2', 'Send money directly in the conversation.')}</li>
                        <li>{t('onChatFeature3', 'Make clear audio and video calls.')}</li>
                    </ul>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                        <Link href="/register">
                            {t('onChatJoinButton', 'Join CashPay')} <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full border-white/30 text-white hover:bg-white/10 hover:text-white">
                        <Link href="/feedback/login">
                           {t('onChatConnectButton', 'Connect Your Existing Account')}
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
