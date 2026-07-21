
"use client";

import { SendPageClient } from "@/components/send/send-page-client";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Suspense, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { getCountriesList } from "@/lib/actions/countries.actions";
import { useRouter } from 'next/navigation';
import type { User, Currency, Country } from "@/lib/types";

function TransferPageLoading() {
    return (
        <div className="w-full max-w-lg mx-auto">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-3/4 mx-auto" />
                    <Skeleton className="h-4 w-1/2 mx-auto" />
                </CardHeader>
                <CardContent className="p-6">
                    <Skeleton className="h-48 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

function TransferPageContent() {
    const [user, setUser] = useState<User | null>(null);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [countries, setCountries] = useState<Country[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            const fetchedUser = await getAuthenticatedUser();
            if (!fetchedUser) {
                router.replace('/login');
                return;
            }
            setUser(fetchedUser);

            const [userCurrencies, countryList] = await Promise.all([
                getUserCurrencies(fetchedUser.id),
                getCountriesList()
            ]);
            setCurrencies(userCurrencies);
            setCountries(countryList);
            setIsLoading(false);
        };
        fetchData();
    }, [router]);

    if (isLoading) {
        return <TransferPageLoading />;
    }

    return <SendPageClient user={user} currencies={currencies} countries={countries} />;
}

export default function TransferPage() {
    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
                <Suspense fallback={<TransferPageLoading />}>
                    <TransferPageContent />
                </Suspense>
            </main>
        </DashboardLayout>
    );
}
