
import { Suspense } from "react";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { getExchangeRatesForCountry } from "@/lib/actions/exchange.actions";
import { ExchangeClient } from "./exchange-client";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { countryToCode, getCountryByCode } from '@/lib/utils';

function ExchangeLoading() {
  return (
    <main className="flex-1 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
          <Card>
              <CardHeader>
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-4 w-3/4 mt-2" />
              </CardHeader>
              <CardContent className="p-0">
                 <div className="p-4">
                    <Skeleton className="h-40 w-full" />
                 </div>
              </CardContent>
          </Card>
          <Card>
              <CardHeader>
                  <Skeleton className="h-6 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
              </CardContent>
          </Card>
      </div>
    </main>
  );
}

async function ExchangeContent() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login');
    }

    const countryCode = user.country ? countryToCode(user.country) : null;
    const countryInfo = countryCode ? getCountryByCode(countryCode) : null;
    const localCurrencyCode = countryInfo?.currency_code || 'USD';
    
    const [currencies, exchangeRates] = await Promise.all([
        getUserCurrencies(user.id),
        getExchangeRatesForCountry(countryCode || 'GBL')
    ]);

    return (
        <ExchangeClient 
            user={user} 
            initialCurrencies={currencies} 
            initialRates={exchangeRates} 
            localCurrencyCode={localCurrencyCode} 
        />
    );
}

export default function ExchangePage() {
  return (
    <DashboardLayout pageTitleKey="pageTitleExchange">
      <Suspense fallback={<ExchangeLoading/>}>
          <ExchangeContent/>
      </Suspense>
    </DashboardLayout>
  );
}
