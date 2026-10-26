'use client';

import Image from 'next/image';
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface UsdtBalanceCardProps {
  /** Solde USDT (TRC-20) du registre CashPay. */
  usdtBalance: number | null;
  onReceive?: () => void;
  onSend?: () => void;
  onBuy?: () => void;
  onSell?: () => void;
  onActivate?: () => void | Promise<void>;
  isActivated?: boolean;
  className?: string;
}

/**
 * Carte de solde USDT (réseau TRC-20), sur le modèle de la carte Bitcoin.
 * Boutons : Recevoir / Envoyer / Acheter / Vendre.
 */
export function UsdtBalanceCard({
  usdtBalance,
  onReceive,
  onSend,
  onBuy,
  onSell,
  onActivate,
  isActivated = false,
  className,
}: UsdtBalanceCardProps) {
  const hasBalance =
    usdtBalance !== null && Number.isFinite(Number(usdtBalance));

  return (
    <Card
      className={cn(
        'w-[19.2rem] h-48 flex-shrink-0 transition-shadow duration-300 hover:shadow-xl text-primary-foreground rounded-2xl shadow-lg relative overflow-hidden',
        'bg-gradient-to-br from-[#0b3d2e] via-[#0a2a21] to-[#050505]',
        className
      )}
    >
      <div className="pointer-events-none absolute -right-8 -bottom-10 z-0 rotate-[-18deg] opacity-[0.08] blur-[1px]">
        <Image
          src="/logos/crypto/usdt.png"
          alt=""
          width={180}
          height={180}
          className="object-contain"
        />
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="absolute right-3 top-3 z-30 h-7 min-w-[58px] px-2 text-[10px] font-semibold border-white/20 bg-black/70 text-white hover:bg-white/10 hover:text-white"
        onClick={onActivate}
        disabled={isActivated}
      >
        {isActivated ? 'Actif' : 'Activer'}
      </Button>

      <CardContent className="p-4 flex flex-col justify-between h-full relative z-10">
        <div>
          <span className="text-base font-semibold text-white">
            Solde USDT
          </span>
          <span className="ml-2 text-[10px] font-medium text-white/55">
            TRC-20
          </span>
        </div>

        <div className="flex-1 flex items-center">
          <p className="text-3xl font-bold tracking-tight text-white">
            {isActivated
              ? hasBalance
                ? `₮ ${Number(usdtBalance).toFixed(2)}`
                : '₮ 0.00'
              : 'Non activé'}
          </p>
        </div>

        {/* Ligne 1 : Recevoir / Envoyer */}
        <div className="grid grid-cols-2 gap-1 mb-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-1 text-[9px] border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            disabled={!isActivated}
            onClick={onReceive}
          >
            <ArrowDownToLine className="mr-0.5 h-3 w-3" />
            Recevoir
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-1 text-[9px] border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            disabled={!isActivated}
            onClick={onSend}
          >
            <ArrowUpFromLine className="mr-0.5 h-3 w-3" />
            Envoyer
          </Button>
        </div>

        {/* Ligne 2 : Acheter / Vendre */}
        <div className="grid grid-cols-2 gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-1 text-[9px] border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
            disabled={!isActivated}
            onClick={onBuy}
          >
            <TrendingUp className="mr-0.5 h-3 w-3" />
            Acheter
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-1 text-[9px] border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
            disabled={!isActivated}
            onClick={onSell}
          >
            <TrendingDown className="mr-0.5 h-3 w-3" />
            Vendre
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
