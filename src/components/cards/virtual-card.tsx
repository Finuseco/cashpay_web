
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    setCard(initialCard);
  }, [initialCard]);

  const handleRevealDetails = async () => {
    if (showDetails) {
      setShowDetails(false);
      return;
    }

    setIsLoadingDetails(true);
    const result = await revealCardDetails(card.id, card.user_id);

    if (result.success && result.number && result.cvv) {
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
  };

  const copyCardNumber = () => {
    const numberToCopy = fullNumber || card.number;
    navigator.clipboard.writeText(numberToCopy.replace(/\s/g, ''));
    toast({
      title: t('toastCopied'),
      description: t('cardNumberCopied'),
    });
  };

  const maskedNumber = `•••• •••• •••• ${card.last4}`;
  const visibleNumber = (fullNumber || card.number || '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  const expiry = card.exp_month && card.exp_year
    ? `${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`
    : '••/••';
  const isMastercard = String(card.brand).toLowerCase() === 'mastercard';

  return (
    <div className="space-y-4">
      {/*
       * Carte statique CashPay : l'illustration vient de public/images/carte.png.
       * Les données restent dynamiques et appartiennent au compte CashPay lié à la carte.
       * Aucun effet de rotation, aucun déplacement/zoom au survol et aucune piste magnétique.
       */}
      <div
        className={cn(
          "relative mx-auto w-full max-w-sm aspect-[2/3] overflow-hidden rounded-[1.25rem] border border-white/20 bg-[#03144d] text-white shadow-2xl"
        )}
        aria-label={`${card.brand.toUpperCase()} ${card.card_type === 'virtuelle' ? 'virtuelle' : 'physique'}`}
      >
        <Image
          src="/images/carte.png"
          alt=""
          fill
          priority={false}
          sizes="(max-width: 640px) 92vw, 384px"
          className="object-cover"
        />

        <div className="absolute inset-0 rounded-[1.25rem] bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none" />

        <div className="absolute inset-0 flex flex-col justify-between p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <Logo variant="white" className="h-7 w-auto drop-shadow-md" />
            <div className="flex flex-col items-end gap-1.5">
              <Badge
                variant="secondary"
                className={cn(
                  "border-0 bg-black/20 text-white backdrop-blur-sm text-[10px] uppercase",
                  card.status !== 'active' && 'bg-red-500/80'
                )}
              >
                {card.status}
              </Badge>
              <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/80">
                {card.card_type === 'virtuelle' ? 'Digital' : 'Physical'}
              </span>
            </div>
          </div>

          <div className="space-y-5">
            <button
              type="button"
              onClick={showDetails ? copyCardNumber : undefined}
              disabled={!showDetails}
              className={cn(
                "block w-full text-left font-mono text-[clamp(1rem,4.7vw,1.45rem)] tracking-[0.14em] text-white drop-shadow-lg",
                showDetails ? "cursor-pointer" : "cursor-default"
              )}
              aria-label={showDetails ? "Copier le numéro de carte" : "Numéro de carte masqué"}
            >
              {showDetails ? visibleNumber : maskedNumber}
            </button>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/75">
                Solde du compte CashPay
              </p>
              <p className="mt-1 text-[clamp(1.35rem,6vw,1.9rem)] font-black tracking-tight text-white drop-shadow-lg">
                {symbol}{balance}
              </p>
            </div>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0 font-mono">
              <p className="text-[8px] uppercase tracking-[0.16em] text-white/70">
                {t('virtualCardHolderLabel')}
              </p>
              <p className="truncate text-xs sm:text-sm font-semibold tracking-wide text-white">
                {displayName}
              </p>
              <div className="mt-2 flex items-center gap-4">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.12em] text-white/65">Valid thru</p>
                  <p className="text-xs font-semibold text-white">{showDetails ? expiry : '••/••'}</p>
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-[0.12em] text-white/65">CVV</p>
                  <p className="text-xs font-semibold text-white">{showDetails ? (cvv || '•••') : '•••'}</p>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end">
              {isMastercard ? (
                <Image src="/logos/mc.png" alt="Mastercard" width={72} height={44} className="h-auto w-14 sm:w-[4.5rem] drop-shadow-md" />
              ) : (
                <Image src="/logos/visa.png" alt="Visa" width={86} height={30} className="h-auto w-16 sm:w-[5.25rem] drop-shadow-md" />
              )}
            </div>
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
