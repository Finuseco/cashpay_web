

'use client';

import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Twitter, Instagram, Facebook, Youtube, Linkedin } from "lucide-react";

export default function AboutPage() {
    const { t } = useTranslation();

    const team = [
        { nameKey: "patrickName", roleKey: "patrickRole", image: "https://placehold.co/100x100.png" },
    ];

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="text-center">
                        <p className="mt-2 text-lg text-muted-foreground">{t('aboutDescription')}</p>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('aboutStoryTitle')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-line">{t('aboutStoryBody')}</p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('aboutTeamTitle')}</CardTitle>
                            <CardDescription>{t('aboutTeamDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {team.map(member => (
                                <div key={member.nameKey} className="flex items-center gap-4">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={member.image} data-ai-hint="man portrait" />
                                        <AvatarFallback>{t(member.nameKey).charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-bold text-lg">{t(member.nameKey)}</p>
                                        <p className="text-primary">{t(member.roleKey)}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('aboutSocialTitle', 'Follow Us')}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex gap-4">
                            <a href="#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Twitter /></a>
                            <a href="#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Instagram /></a>
                            <a href="#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Facebook /></a>
                            <a href="#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Youtube /></a>
                            <a href="#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Linkedin /></a>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('aboutLegalTitle')}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                           <p><span className="font-semibold">{t('aboutLegalCompany')}:</span> FINUSECO SARL</p>
                           <p><span className="font-semibold">{t('aboutLegalRccm')}:</span> CD/KIN/RCCM/00-X-00000</p>
                           <p><span className="font-semibold">{t('aboutLegalIdNat')}:</span> 00-000-X00000X</p>
                           <p className="pt-4 text-xs text-muted-foreground">{t('aboutCopyright')}</p>
                        </CardContent>
                    </Card>

                </div>
            </main>
        </DashboardLayout>
    );
}
