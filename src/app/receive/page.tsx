
'use client';

import { useState, useEffect } from "react";
import { InternationalTransferForm } from "@/components/receive/international-transfer-form";
import type { User, Country } from "@/lib/types";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getCountriesList } from "@/lib/actions/countries.actions";
import { Loader2, QrCode, Globe } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReceiveQrCode } from "@/components/receive/receive-qr-code";

/**
 * Page de réception simplifiée.
 * Évite les rendus lourds au chargement pour prévenir la page blanche.
 */
export default function ReceivePage() {
  const [user, setUser] = useState<User | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [fetchedUser, fetchedCountries] = await Promise.all([
                getAuthenticatedUser(),
                getCountriesList(),
            ]);
            setUser(fetchedUser);
            setCountries(fetchedCountries);
        } catch (e) {
            console.error("Error loading receive data", e);
        } finally {
            setIsLoading(false);
        }
    }
    fetchData();
  }, []);

  return (
    <DashboardLayout pageTitleKey="pageTitleReceive">
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-64 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Initialisation du tunnel sécurisé...</p>
            </div>
          ) : (
            <Tabs defaultValue="qr_code" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 h-14 rounded-2xl mb-8">
                  <TabsTrigger value="qr_code" className="font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md">
                    <QrCode className="mr-2 h-4 w-4"/>QR Code Direct
                  </TabsTrigger>
                  <TabsTrigger value="international" className="font-black uppercase text-[10px] tracking-widest rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md">
                    <Globe className="mr-2 h-4 w-4"/>Réclamation
                  </TabsTrigger>
              </TabsList>
              
              <TabsContent value="qr_code" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ReceiveQrCode user={user} />
              </TabsContent>
              
              <TabsContent value="international" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <InternationalTransferForm user={user} countries={countries} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
