
"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { InternationalTransferForm } from "@/components/receive/international-transfer-form";
import type { User, Country } from "@/lib/types";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getCountriesList } from "@/lib/actions/countries.actions";
import { Loader2 } from "lucide-react";
import { QrCode, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReceiveQrCode } from "@/components/receive/receive-qr-code";


export default function ReceivePage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        const [fetchedUser, fetchedCountries] = await Promise.all([
            getAuthenticatedUser(),
            getCountriesList(),
        ]);
        setUser(fetchedUser);
        setCountries(fetchedCountries);
        setIsLoading(false);
    }
    fetchData();
  }, []);

  return (
    <DashboardLayout pageTitleKey="pageTitleReceive">
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Tabs defaultValue="qr_code" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="qr_code"><QrCode className="mr-2 h-4 w-4"/>{t('receiveQrCodeTitle')}</TabsTrigger>
                  <TabsTrigger value="international"><Globe className="mr-2 h-4 w-4"/>{t('receiveIntlTransferTitle')}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="qr_code" className="mt-6">
                <ReceiveQrCode user={user} />
              </TabsContent>
              
              <TabsContent value="international" className="mt-6">
                  <InternationalTransferForm user={user} countries={countries} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
