
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { History, Loader2 } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getInvestmentsForUser } from '@/lib/actions/investment.actions';
import type { User, Investment } from '@/lib/types';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useTranslation } from "react-i18next";


function HistoryLoadingSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

const statusStyles: Record<Investment['status'], string> = {
    pending: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
    approved: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    matured: 'bg-green-500/20 text-green-500 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-500 border-red-500/30',
    cancelled: 'bg-zinc-500/20 text-zinc-500 border-zinc-500/30'
};


function InvestmentHistoryClient() {
    const [user, setUser] = useState<User | null>(null);
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const { t } = useTranslation();
    
    const statusTranslations: Record<Investment['status'], string> = {
        pending: t('datStatusPending'),
        approved: t('datStatusApproved'),
        matured: t('datStatusMatured'),
        rejected: t('datStatusRejected'),
        cancelled: t('datStatusCancelled')
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const fetchedUser = await getAuthenticatedUser();
            if (fetchedUser) {
                setUser(fetchedUser);
                const fetchedInvestments = await getInvestmentsForUser(fetchedUser.id);
                setInvestments(fetchedInvestments);
            } else {
                router.push('/login');
            }
            setIsLoading(false);
        };
        fetchData();
    }, [router]);

    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">{t('datHistoryTitle')}</h1>
                    <p className="text-muted-foreground">{t('datHistoryDescription')}</p>
                </div>
                {isLoading ? <HistoryLoadingSkeleton /> : (
                <Card>
                    <CardHeader>
                        <CardTitle>{t('datHistoryMyDats')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead>{t('datHistoryAmount')}</TableHead>
                                    <TableHead>{t('datHistoryDuration')}</TableHead>
                                    <TableHead>{t('datHistoryTotalReturn')}</TableHead>
                                    <TableHead>{t('datHistorySubmissionDate')}</TableHead>
                                    <TableHead className="text-right">{t('datHistoryStatus')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {investments.length > 0 ? (
                                    investments.map(inv => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-semibold">{inv.amount.toLocaleString()} {inv.currency}</TableCell>
                                            <TableCell>{t('datDurationMonths', { duration: inv.duration })}</TableCell>
                                            <TableCell>{inv.total_return.toLocaleString()} {inv.currency}</TableCell>
                                            <TableCell>{format(new Date(inv.created_at), 'd MMMM yyyy', { locale: fr })}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge className={cn(statusStyles[inv.status])}>{statusTranslations[inv.status]}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">{t('datHistoryNoDats')}</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                )}
            </div>
        </main>
    );
}

export default function InvestmentHistoryPage() {
    return (
        <DashboardLayout pageTitleKey="Historique des Dépôts">
            <Suspense fallback={<HistoryLoadingSkeleton />}>
                <InvestmentHistoryClient />
            </Suspense>
        </DashboardLayout>
    );
}
