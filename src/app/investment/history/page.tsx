

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
import InvestmentHistoryClient from './investment-history-client';


function HistoryLoadingSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
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
