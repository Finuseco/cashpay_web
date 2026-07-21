

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

  return (
    <Tabs defaultValue="appearance" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="appearance">
          <Palette className="mr-2 h-4 w-4" />
          {isClient ? t('settingsAppearanceTab') : 'Appearance'}
        </TabsTrigger>
        <TabsTrigger value="security">
          <Shield className="mr-2 h-4 w-4" />
          {isClient ? t('settingsSecurityTab') : 'Security'}
        </TabsTrigger>
        <TabsTrigger value="billing">
            <Repeat className="mr-2 h-4 w-4" />
            Paiements
        </TabsTrigger>
      </TabsList>
      <TabsContent value="appearance">
        <AppearanceSettings />
      </TabsContent>
      <TabsContent value="security">
        <SecuritySettings user={user} />
      </TabsContent>
       <TabsContent value="billing">
        <BillingAgreements user={user} />
      </TabsContent>
    </Tabs>
  );
}
