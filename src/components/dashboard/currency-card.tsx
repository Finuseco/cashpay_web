
'use client';

import { useTranslation } from "react-i18next";
import { Copy, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { cn } from "@/lib/utils";
import type { Currency, Card as CardType } from "@/lib/types";
import { useState, useEffect } from "react";
import Image from "next/image";

interface CurrencyCardProps extends Currency {
  idWallet: string | null;
  holderName: string | null;
  className?: string;
  cardBrand?: CardType['brand'];
  cardLast4?: string;
}

const currencyColors: { [key: string]: string } = {
    USD: 'bg-gradient-to-br from-[#000E38] to-[#000E38]/80',
    EUR: 'bg-gradient-to-br from-blue-700 to-blue-500',
    CDF: 'bg-gradient-to-br from-orange-600 to-orange-400',
};

export function CurrencyCard({ code, balance, idWallet, holderName, symbol, className, cardBrand, cardLast4 }: CurrencyCardProps) {
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const copyToClipboard = () => {
    if (idWallet) {
      navigator.clipboard.writeText(idWallet);
      openAlert({
        variant: 'info',
        title: isClient ? t('toastCopied') : 'Copied!',
        description: isClient ? t('toastCopiedDescription') : 'Wallet ID copied to clipboard.',
      });
    }
  };

  return (
    <Card 
        className={cn(
            "w-[19.2rem] h-40 flex-shrink-0 transition-shadow duration-300 hover:shadow-xl text-primary-foreground rounded-2xl shadow-lg relative overflow-hidden",
            currencyColors[code] || 'bg-gray-500'
        )}
        style={{ '--tw-shadow-color': 'hsl(var(--primary) / 0.5)' } as React.CSSProperties}
    >
       <Wallet className="absolute -right-8 -bottom-8 h-32 w-32 text-white/10 -rotate-12" />
       {cardBrand && (
          <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
              {cardBrand === 'visa' && <Image src="/logos/visa.png" alt="Visa" width={60} height={20} />}
              {cardBrand === 'mastercard' && <Image src="/logos/mc.png" alt="Mastercard" width={40} height={25} />}
              {cardLast4 && <p className="text-xs font-mono opacity-70 tracking-widest">•••• {cardLast4}</p>}
          </div>
        )}
      <CardContent className="p-4 flex flex-col justify-between h-full relative z-10">
        <div>
          <span className="text-base font-semibold">{isClient ? t('currencyCardAvailableBalance') : 'Available Balance'}</span>
          <p className="text-3xl font-bold tracking-tight mt-1">{symbol}{balance}</p>
        </div>
        
        <div className="text-sm font-medium space-y-1">
          {idWallet ? (
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs">N° de compte CP : {idWallet}</p>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground hover:bg-white/20" onClick={copyToClipboard} disabled={!idWallet}>
                <Copy className="h-4 w-4" />
                <span className="sr-only">Copy Wallet ID</span>
              </Button>
            </div>
          ) : (
            <div className="h-5 w-48 bg-white/20 animate-pulse rounded-md mt-1" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
