
'use client';

import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { User } from "@/lib/types";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getLoanMePartnerDetails } from "@/lib/actions/loanme.actions";
import { LoanMePartnerDashboard } from "@/components/mlm/loanme-partner-dashboard";

function LoanMeLoading() {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
}

function LoanMeOnboarding() {
    const { t } = useTranslation('MLM');
    return (
        <Card className="text-center">
            <CardHeader>
                <CardTitle>{t('mlmLoanMeBecomePartnerTitle')}</CardTitle>
                <CardDescription>{t('mlmLoanMeBecomePartnerDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="mb-4">{t('mlmLoanMeEligibility')}</p>
                <Button asChild>
                    <Link href="/mlm/loanme/register">{t('mlmLoanMeRegisterButton')}</Link>
                </Button>
            </CardContent>
        </Card>
    );
}

export default function LoanMePage() {
    const { t } = useTranslation('MLM');
    const [user, setUser] = useState<User | null>(null);
    const [partnerDetails, setPartnerDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            setIsLoading(true);
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
            if (fetchedUser) {
                const details = await getLoanMePartnerDetails(fetchedUser.id);
                setPartnerDetails(details);
            }
            setIsLoading(false);
        };
        fetchDetails();
    }, []);

    return (
        <DashboardLayout pageTitleKey="pageTitleLoanMe">
            <main className="flex-1 p-4 md:p-8">
                 <div className="max-w-6xl mx-auto space-y-8">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-foreground">
                            {t('mlmLoanMeTitle')}
                        </h1>
                        <p className="text-muted-foreground mt-2">{t('mlmLoanMeSubDescription')}</p>
                    </div>
                    
                    <Suspense fallback={<LoanMeLoading/>}>
                        {isLoading ? (
                            <LoanMeLoading />
                        ) : partnerDetails && partnerDetails.status === 'active' ? (
                            <LoanMePartnerDashboard partner={partnerDetails} />
                        ) : (
                            <LoanMeOnboarding />
                        )}
                    </Suspense>
                </div>
            </main>
        </DashboardLayout>
    );
}
    
