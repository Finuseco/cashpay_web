'use client';

import Image from 'next/image';
import { ArrowDownToLine, ArrowUpFromLine, ShoppingCart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface BitcoinFiatValue {
  code: string;
  symbol?: string;
  value: string;
}

interface BitcoinBalanceCardProps {
  btcBalance: number | null;
  onReceive?: () => void;
  onSend?: () => void;
  onBuy?: () => void;
  onSell?: () => void;
  onActivate?: () => void;
  isActivated?: boolean;
  className?: string;
}

export function BitcoinBalanceCard({
  btcBalance,
  onReceive,
  onSend,
  onBuy,
  onSell,
  onActivate,
  isActivated = false,
  className,
}: BitcoinBalanceCardProps) {
  const hasBalance =
    btcBalance !== null &&
    Number.isFinite(Number(btcBalance));

  return (
    <Card
      className={cn(
        "w-96 h-40 flex-shrink-0",
        "rounded-2xl shadow-lg relative overflow-hidden",
        "bg-gradient-to-br from-[#161616] via-[#111111] to-[#050505]",
        "text-white transition-shadow duration-300 hover:shadow-xl",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-10 -bottom-10 z-0 rotate-[-18deg] opacity-[0.07] blur-[1px]">
        <Image
          src="/logos/btc.png"
          alt=""
          width={190}
          height={190}
          className="object-contain"
        />
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="absolute right-3 top-3 z-30 h-7 min-w-[58px] px-2 text-[10px] font-semibold border-white/20 bg-black/60 text-white hover:bg-white/10 hover:text-white"
        onClick={onActivate}
        disabled={isActivated}
      >
        {isActivated ? "Actif" : "Activer"}
      </Button>

      <CardContent className="relative z-10 h-full p-4 flex flex-col justify-between">
        <div className="pr-20">
          <p className="text-sm font-semibold text-white">
            Bitcoin
          </p>
          <p className="mt-1 text-[10px] font-medium text-white/55">
            Solde Bitcoin
          </p>
        </div>

        <div>
          <p className="text-2xl font-bold tracking-tight">
            {isActivated
              ? hasBalance
                ? `₿ ${Number(btcBalance).toFixed(8)}`
                : "₿ 0.00000000"
              : "Non activé"}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!isActivated}
            className="h-7 px-1 text-[9px] border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={onReceive}
          >
            <ArrowDownToLine className="mr-1 h-3 w-3" />
            Recevoir
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!isActivated}
            className="h-7 px-1 text-[9px] border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={onSend}
          >
            <ArrowUpFromLine className="mr-1 h-3 w-3" />
            Envoyer
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!isActivated}
            className="h-7 px-1 text-[9px] border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={onBuy}
          >
            <ShoppingCart className="mr-1 h-3 w-3" />
            Acheter
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!isActivated}
            className="h-7 px-1 text-[9px] border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={onSell}
          >
            Vendre
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  );
}
