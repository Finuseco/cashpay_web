'use client';

import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowRight, Handshake, Network, Users, Loader2 } from "lucide-react";
import Link from 'next/link';
import { useState, useEffect } from "react";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getMlmPartnerDetails } from "@/lib/actions/mlm.actions";
import { Badge } from "@/components/ui/badge";

const ServiceCard = ({ title, description, href, icon: Icon, status }: { title: string, description: string, href: string, icon: React.ElementType, status?: string }) => {
    const { t } = useTranslation('MLM');
    return (
        <Link href={href} className="group">
            <Card className="hover:border-primary hover:shadow-lg transition-all h-full flex flex-col relative overflow-hidden">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <CardTitle className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                <Icon className="h-6 w-6 text-primary" />
                            </div>
                            <span>{title}</span>
                        </CardTitle>
                        {status && (
                            <Badge className={status === 'active' || status === 'approved' ? "bg-green-500" : "bg-yellow-500"}>
                                {status === 'active' || status === 'approved' ? 'Actif' : 'En attente'}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="flex-1">
                    <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
                <CardContent>
                    <div className="text-sm font-semibold text-primary flex items-center gap-2">
                        {t('mlmAccessService')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
};


export default function MlmPage() {
    const { t } = useTranslation('MLM');
    const [partnerDetails, setPartnerDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            const user = await getAuthenticatedUser();
            if (user) {
                const details = await getMlmPartnerDetails(user.id);
                setPartnerDetails(details);
            }
            setIsLoading(false);
        };
        checkStatus();
    }, []);

    return (
        <DashboardLayout pageTitleKey="pageTitleMlm">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-6xl mx-auto space-y-8">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-foreground">
                            {t('pageTitleMlm')}
                        </h1>
                        <p className="text-muted-foreground mt-2">{t('mlmPageDescription')}</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <ServiceCard
                            title={t('mlmNetworkMarketingTitle')}
                            description={t('mlmNetworkPartnerDescription')}
                            href="/mlm/network-marketing"
                            icon={Network}
                            status={partnerDetails?.status}
                        />
                        <ServiceCard
                            title={t('mlmMyNetworkTitle')}
                            description={t('mlmMyNetworkDescription')}
                            href="/mlm/my-network"
                            icon={Users}
                        />
                        <ServiceCard
                            title={t('mlmLoanMeTitle')}
                            description={t('mlmLoanMeDescription')}
                            href="/mlm/loanme"
                            icon={Handshake}
                        />
                    </div>
                </div>
            </main>
        </DashboardLayout>
    );
}
