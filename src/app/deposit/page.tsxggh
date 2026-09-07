
"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DepositClient } from "@/components/deposit/deposit-client";
import type { User, Country } from "@/lib/types";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { countryToCode, getCountryByCode } from "@/lib/utils";

function DepositPageLoading() {
    const { t } = useTranslation();
    return (
        <Card>
            <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                <p className="text-muted-foreground">{t('depositLoadingOptions')}</p>
            </CardContent>
        </Card>
    );
}

export default function DepositPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [userCountry, setUserCountry] = useState<Country | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
        setIsLoading(true);
        const fetchedUser = await getAuthenticatedUser();
        setUser(fetchedUser);

        if (fetchedUser?.country) {
            const userCountryCode = countryToCode(fetchedUser.country);
            if(userCountryCode) {
                const countryData = getCountryByCode(userCountryCode);
                if (countryData) {
                    setUserCountry(countryData);
                }
            }
        }
        setIsLoading(false);
    };
    fetchInitialData();
  }, []);

  return (
    <DashboardLayout pageTitleKey="pageTitleDeposit">
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
            {isLoading ? (
                <DepositPageLoading />
            ) : user && userCountry ? (
                <DepositClient user={user} selectedCountry={userCountry} />
            ) : (
                 <Card>
                    <CardContent className="p-8 text-center">
                        <h3 className="font-semibold">{t('depositServiceUnavailable')}</h3>
                        <p className="text-muted-foreground mt-2">{t('depositCompleteProfile')}</p>
                    </CardContent>
                </Card>
            )}
        </div>
      </main>
    </DashboardLayout>
  );
}
