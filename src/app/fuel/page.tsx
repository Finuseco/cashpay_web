
'use client';

import { useState, useEffect } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getFuelStations } from '@/lib/actions/fuel.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { FuelPurchaseClient } from '@/components/fuel/fuel-purchase-client';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { countryToCode } from '@/lib/utils';
import type { User, FuelStation, Currency } from '@/lib/types';

function LoadingSkeleton() {
    return (
        <div className="max-w-md mx-auto space-y-6 pt-10">
            <Skeleton className="h-12 w-3/4 mx-auto mb-8" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        </div>
    );
}

export default function FuelPage() {
    const [user, setUser] = useState<User | null>(null);
    const [stations, setStations] = useState<FuelStation[]>([]);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            const currentUser = await getAuthenticatedUser();
            if (currentUser) {
                setUser(currentUser);
                const code = countryToCode(currentUser.country);
                const [data, walletCurrencies] = await Promise.all([
                    getFuelStations(code),
                    getUserCurrencies(currentUser.id)
                ]);
                setStations(data);
                setCurrencies(walletCurrencies);
            }
            setIsLoading(false);
        };
        init();
    }, []);

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                {isLoading ? (
                    <LoadingSkeleton />
                ) : user ? (
                    <FuelPurchaseClient 
                        user={user} 
                        initialStations={stations} 
                        currencies={currencies} 
                    />
                ) : null}
            </main>
        </DashboardLayout>
    );
}
