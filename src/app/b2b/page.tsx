
'use client';

import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, KeyRound, Code2, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const FeatureCard = ({ icon, titleKey, descriptionKey }: { icon: React.ReactNode, titleKey: string, descriptionKey: string }) => {
    const { t } = useTranslation();
    return (
        <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted shrink-0">
                {icon}
            </div>
            <div>
                <h3 className="font-semibold">{t(titleKey)}</h3>
                <p className="text-sm text-muted-foreground">{t(descriptionKey)}</p>
            </div>
        </div>
    )
}

export default function B2BPage() {
    const { t } = useTranslation();
    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-3">
                            <Briefcase className="h-8 w-8 text-primary"/>
                            {t('b2bPageTitle')}
                        </h1>
                        <p className="text-muted-foreground mt-2">{t('b2bPageDescription')}</p>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('b2bBaaSTitle')}</CardTitle>
                            <CardDescription>
                                {t('b2bBaaSDescription')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-6">
                            <FeatureCard 
                                icon={<KeyRound className="h-6 w-6 text-primary"/>} 
                                titleKey="b2bFeatureCardIssuingTitle"
                                descriptionKey="b2bFeatureCardIssuingDesc"
                            />
                             <FeatureCard 
                                icon={<Code2 className="h-6 w-6 text-primary"/>} 
                                titleKey="b2bFeatureApiTitle"
                                descriptionKey="b2bFeatureApiDesc"
                            />
                             <FeatureCard 
                                icon={<Users className="h-6 w-6 text-primary"/>} 
                                titleKey="b2bFeatureUserManagementTitle"
                                descriptionKey="b2bFeatureUserManagementDesc"
                            />
                            <FeatureCard 
                                icon={<FileText className="h-6 w-6 text-primary"/>} 
                                titleKey="b2bFeaturePartnerPortalTitle"
                                descriptionKey="b2bFeaturePartnerPortalDesc"
                            />
                        </CardContent>
                    </Card>

                    <div className="text-center">
                        <h2 className="text-xl font-semibold">{t('b2bReadyToStartTitle')}</h2>
                        <p className="text-muted-foreground mt-1">{t('b2bReadyToStartDesc')}</p>
                        <Button asChild size="lg" className="mt-4">
                            <Link href="/feedback">{t('b2bContactSupportButton')}</Link>
                        </Button>
                    </div>
                </div>
            </main>
        </DashboardLayout>
    );
}
