
'use client';

import { useTranslation } from "react-i18next";
import { Wallet, Smartphone, Globe, Mail, Landmark } from "lucide-react";
import Image from "next/image";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TransferTypeOption = 'national' | 'mobile_money' | 'paypal';

export function TransferOptions({ onSelect }: { onSelect: (type: TransferTypeOption) => void }) {
  const { t } = useTranslation();

  const options = [
    { 
      type: 'national' as const, 
      label: 'Transfert CashPay', 
      description: 'Envoi instantané national et international entre comptes CashPay.', 
      icon: Wallet, 
      color: 'bg-primary/10 text-primary' 
    },
    { 
      type: 'mobile_money' as const, 
      label: 'Mobile Money Afrique', 
      description: 'Envoyez vers Airtel, M-Pesa, Orange dans plusieurs pays.', 
      icon: Smartphone, 
      color: 'bg-blue-500/10 text-blue-600' 
    },
    { 
      type: 'paypal' as const, 
      label: 'Virement PayPal', 
      description: 'Transférez vos fonds vers un compte PayPal (International).', 
      icon: Mail, 
      color: 'bg-sky-500/10 text-sky-600' 
    },
  ];

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="text-center px-0">
        <CardTitle className="text-2xl font-black uppercase">Envoyer de l'argent</CardTitle>
        <CardDescription>Sélectionnez un mode d'envoi pour continuer.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        {options.map(opt => (
          <button 
            key={opt.type} 
            className="w-full flex items-center gap-4 p-5 rounded-2xl bg-card border border-zinc-100 hover:border-primary hover:shadow-md transition-all text-left" 
            onClick={() => onSelect(opt.type)}
          >
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl shrink-0", opt.color)}>
                <opt.icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">{opt.label}</h3>
              <p className="text-xs text-muted-foreground leading-tight mt-1">{opt.description}</p>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
