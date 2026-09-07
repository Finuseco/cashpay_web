
'use client';

import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearanceSettings } from "./appearance-settings";
import { SecuritySettings } from "./security-settings";
import { Shield, Palette, Repeat } from "lucide-react";
import type { User } from '@/lib/types';
import { BillingAgreements } from "./billing-agreements";

export function SettingsClient({ user }: { user: User | null }) {
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  return (
    <Tabs defaultValue="security" className="w-full">
      <TabsList className="grid w-full grid-cols-3 h-12 bg-muted/50 p-1 mb-6 rounded-xl">
        <TabsTrigger value="appearance" className="text-xs font-bold uppercase tracking-tighter">
          <Palette className="mr-1.5 h-3.5 w-3.5 hide-mobile" />
          {t('settingsAppearanceTab', 'Style')}
        </TabsTrigger>
        <TabsTrigger value="security" className="text-xs font-bold uppercase tracking-tighter">
          <Shield className="mr-1.5 h-3.5 w-3.5 hide-mobile" />
          {t('settingsSecurityTab', 'Sécurité')}
        </TabsTrigger>
        <TabsTrigger value="billing" className="text-xs font-bold uppercase tracking-tighter">
            <Repeat className="mr-1.5 h-3.5 w-3.5 hide-mobile" />
            Paiements
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="appearance" className="mt-0 outline-none animate-in fade-in duration-300">
        <AppearanceSettings />
      </TabsContent>
      
      <TabsContent value="security" className="mt-0 outline-none animate-in fade-in duration-300">
        <SecuritySettings user={user} />
      </TabsContent>
      
      <TabsContent value="billing" className="mt-0 outline-none animate-in fade-in duration-300">
        <BillingAgreements user={user} />
      </TabsContent>

      <style jsx global>{`
        @media (max-width: 640px) {
            .hide-mobile { display: none; }
        }
      `}</style>
    </Tabs>
  );
}
