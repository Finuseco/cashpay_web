
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, ShieldCheck, Loader2, Wallet } from "lucide-react";
import { cn } from '@/lib/utils';
import type { Card } from '@/lib/types';
import { revealCardDetails } from "@/lib/actions/card.actions";
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Logo } from '../logo';
import { useToast } from '@/hooks/use-toast';

export function VirtualCard({ card: initialCard, balance, symbol }: { card: Card, balance: string, symbol: string }) {
  const [showDetails, setShowDetails] = useState(false);
  const [card, setCard] = useState(initialCard);
  const [fullNumber, setFullNumber] = useState<string | null>(null);
  const [cvv, setCvv] = useState<string | null>(null);
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const { toast } = useToast();
  const displayName = card.holder.split(' ').slice(0, 2).join(' ').toUpperCase();
  const [isClient, setIsClient] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setCard(initialCard);
  }, [initialCard]);
  
  const handleRevealDetails = async () => {
    if (showDetails) {
        setShowDetails(false);
        return;
    }

    setIsLoadingDetails(true);
    const result = await revealCardDetails(card.id, card.user_id);
    
    if(result.success && result.number && result.cvv) {
        setFullNumber(result.number);
        setCvv(result.cvv);
        setShowDetails(true);
    } else {
        openAlert({ 
            title: t('cardTransferErrorTitle'), 
            description: result.error || "Impossible de récupérer les détails de la carte.", 
            variant: 'error' 
        });
    }
    setIsLoadingDetails(false);
  }

  const copyCardNumber = () => {
    const numberToCopy = fullNumber || card.number;
    navigator.clipboard.writeText(numberToCopy.replace(/\s/g, ''));
    toast({
        title: t('toastCopied'),
        description: t('cardNumberCopied'),
    });
  };

  const cardGradients = {
    visa: 'from-blue-600 to-indigo-800',
    mastercard: 'from-orange-500 via-red-500 to-yellow-400',
    physique: 'from-zinc-700 to-zinc-900',
  };
  
  const cardType = card.card_type === 'physique' ? 'physique' : card.brand.toLowerCase() as 'visa' | 'mastercard';

  return (
    <div className="space-y-4">
        <div 
            onClick={() => showDetails && copyCardNumber()}
            className={cn(
            "relative aspect-[1.586] w-full max-w-sm mx-auto rounded-2xl p-6 text-white shadow-2xl flex flex-col justify-between overflow-hidden bg-gradient-to-br transition-all hover:scale-105",
            showDetails ? "cursor-pointer" : "cursor-default",
            cardGradients[cardType]
        )}>
            <Wallet className="absolute -right-8 -bottom-8 h-40 w-40 text-white/10 -rotate-12" />
            <div className="flex justify-between items-start">
                <Logo variant="white" className="h-6" />
                <div className="flex flex-col items-end gap-2">
                    <Badge variant="secondary" className={cn("bg-white/20 text-white border-0 text-xs", card.status !== 'active' && 'bg-red-500/80')}>{card.status}</Badge>
                    <Badge variant="outline" className="text-[8px] border-white/20 text-white">DEBIT DIRECT</Badge>
                </div>
            </div>
            
            <div className="space-y-4 text-left">
                 <p className="text-xl sm:text-2xl font-mono tracking-widest text-shadow-lg">
                    {showDetails ? (fullNumber || card.number).replace(/(\d{4})/g, '$1 ').trim() : `•••• •••• •••• ${card.last4} `}
                </p>
                <div>
                    <p className="text-[10px] uppercase font-bold opacity-70 mb-0 tracking-widest">Solde Portefeuille {card.currency}</p>
                    <p className="text-2xl font-bold tracking-tight">{symbol}{balance}</p>
                </div>
            </div>
            
            <div className="flex justify-between items-end">
                <div className="font-mono text-sm">
                    <p className="text-xs opacity-70 mb-1">{t('virtualCardHolderLabel')}</p>
                    <p className="font-medium leading-tight">{displayName}</p>
                    <div className="flex items-center gap-4 mt-2">
                        <div>
                            <p className="text-xs opacity-70">{t('virtualCardExpiresLabel')}</p>
                            <p className="font-medium">{showDetails ? `${card.exp_month}/${card.exp_year.toString().slice(-2)}` : '••/••'}</p>
                        </div>
                        <div>
                            <p className="text-xs opacity-70">CVV</p>
                            <p className="font-medium">{showDetails ? cvv : '•••'}</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    {card.brand === 'mastercard' && (
                        <Image src="/logos/mc.png" alt="Mastercard" width={60} height={36} className="h-auto w-14" />
                    )}
                    {card.brand === 'visa' && (
                        <Image src="/logos/visa.png" alt="Visa" width={80} height={26} className="h-auto w-20" />
                    )}
                    <p className="text-xs font-semibold mt-1 opacity-80">{card.card_type === 'virtuelle' ? 'DIGITAL' : 'PHYSICAL'}</p>
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-1 gap-2">
            <Button variant="outline" size="sm" onClick={handleRevealDetails} disabled={isLoadingDetails}>
                {isLoadingDetails ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : showDetails ? (
                    <EyeOff className="mr-2 h-4 w-4" />
                ) : (
                    <Eye className="mr-2 h-4 w-4" />
                )}
                {showDetails ? t('hideCardDetails') : t('showCardDetails')}
            </Button>
        </div>
    </div>
  );
}
