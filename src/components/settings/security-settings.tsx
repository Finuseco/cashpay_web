
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { 
    KeyRound, Globe, Usb, Terminal, 
    FileCode, Bot, Briefcase, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BecomeAgentSection } from './become-agent';
import { AiAssistantSettings } from './ai-assistant-settings';
import { getGoogleOauthUrl } from '@/services/google';
import Link from 'next/link';
import type { User } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChangePinForm } from './change-pin-form';
import { cn } from '@/lib/utils';

const SettingsRow = ({ 
    icon: Icon, 
    title, 
    description, 
    children, 
    onClick 
}: { 
    icon: React.ElementType, 
    title: string, 
    description: string, 
    children?: React.ReactNode,
    onClick?: () => void
}) => (
    <div 
        className={cn(
            "flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b last:border-0 border-zinc-100 gap-3",
            onClick && "cursor-pointer active:bg-zinc-50 transition-colors"
        )}
        onClick={onClick}
    >
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground leading-tight">{description}</p>
          </div>
        </div>
        <div className="flex justify-end sm:ml-4 shrink-0">
            {children || <ChevronRight className="h-4 w-4 text-zinc-300" />}
        </div>
    </div>
);

export function SecuritySettings({ user }: { user: User | null }) {
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !user) {
      return (
        <div className="space-y-4">
            <div className="h-40 w-full bg-muted animate-pulse rounded-2xl" />
            <div className="h-40 w-full bg-muted animate-pulse rounded-2xl" />
        </div>
      );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Accès & Authentification */}
      <Card className="border-none shadow-md overflow-hidden rounded-2xl">
        <CardHeader className="bg-primary/5 border-b border-primary/5 py-4">
            <CardTitle className="text-base font-black uppercase tracking-widest text-primary">Accès & Sécurité</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
           <SettingsRow 
                icon={KeyRound} 
                title="Code PIN Secret" 
                description="Modifiez votre code à 4 chiffres pour valider vos transactions."
           >
                <Button variant="outline" size="sm" className="h-8 font-bold text-xs" onClick={() => setIsPinDialogOpen(true)}>
                    Modifier
                </Button>
           </SettingsRow>
           
           <SettingsRow 
                icon={Globe} 
                title="Compte Google" 
                description="Simplifiez votre connexion en liant votre identité Google."
           >
                <Button variant="outline" size="sm" className="h-8 font-bold text-xs" onClick={async () => { window.location.href = await getGoogleOauthUrl(); }}>
                    Lier mon compte
                </Button>
           </SettingsRow>
           
           <SettingsRow 
                icon={Usb} 
                title="Coffre-fort USB" 
                description="Gérez vos certificats de valeur matériels (CPK)."
           >
                <Button asChild variant="outline" size="sm" className="h-8 font-bold text-xs">
                    <Link href="/cpk">Ouvrir</Link>
                </Button>
           </SettingsRow>
        </CardContent>
      </Card>
      
      {/* 2. Statut Professionnel */}
      <Card className="border-none shadow-md overflow-hidden rounded-2xl">
        <CardHeader className="bg-primary/5 border-b border-primary/5 py-4">
            <CardTitle className="text-base font-black uppercase tracking-widest text-primary">Statut Professionnel</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 py-4">
            <BecomeAgentSection user={user} />
        </CardContent>
      </Card>

      {/* 3. Assistant Répondeur */}
      <Card className="border-none shadow-md overflow-hidden rounded-2xl">
          <CardHeader className="bg-primary/5 border-b border-primary/5 py-4">
            <CardTitle className="text-base font-black uppercase tracking-widest text-primary">Assistant Répondeur</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 py-4">
              <AiAssistantSettings user={user} />
          </CardContent>
      </Card>
      
      {/* 4. Outils Avancés */}
      <Card className="border-none shadow-md overflow-hidden rounded-2xl opacity-90">
          <CardHeader className="bg-zinc-100 border-b py-3">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Laboratoire Souverain</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
              <SettingsRow 
                icon={Terminal} 
                title="Simulateur USSD" 
                description="Testez les menus GSM *2704# en conditions réelles."
              >
                 <Button asChild variant="ghost" size="sm" className="h-8 text-primary font-black text-[10px]">
                    <Link href="/ussd-simulator">LANCER</Link>
                </Button>
              </SettingsRow>
               <SettingsRow 
                icon={FileCode} 
                title="CashPay Reader" 
                description="Vérifiez l'intégrité de vos certificats .cpk."
              >
                 <Button asChild variant="ghost" size="sm" className="h-8 text-primary font-black text-[10px]">
                    <Link href="/reader">OUVRIR</Link>
                </Button>
              </SettingsRow>
          </CardContent>
      </Card>

      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
          <DialogContent className="max-w-xs bg-zinc-900 border-zinc-800 text-white p-6 rounded-[2rem]">
              <DialogHeader className="text-center">
                  <DialogTitle className="text-xl font-black">Nouveau Code PIN</DialogTitle>
              </DialogHeader>
              <ChangePinForm onFormSubmit={() => setIsPinDialogOpen(false)} />
          </DialogContent>
      </Dialog>
    </div>
  );
}
