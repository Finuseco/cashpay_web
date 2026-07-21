
import { Suspense } from "react";
import { SendPageClient } from "@/components/send/send-page-client";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { getCountriesList } from "@/lib/actions/countries.actions";
import { redirect } from 'next/navigation';

function SendPageLoading() {
    return (
        <div className="w-full max-w-lg mx-auto">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-3/4 mx-auto" />
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

async function SendPageContent() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login');
    }

    const [currencies, countries] = await Promise.all([
        getUserCurrencies(user.id),
        getCountriesList()
    ]);

    return <SendPageClient user={user} currencies={currencies} countries={countries} />;
}

export default function SendPage() {
    return (
        <DashboardLayout pageTitleKey="pageTitleSend">
            <main className="flex-1 p-4 md:p-8 flex items-start justify-center bg-muted/30">
                 <Suspense fallback={<SendPageLoading />}>
                    <SendPageContent />
                 </Suspense>
            </main>
        </DashboardLayout>
    );
}
