'use client';

import { ArrowDownToLine, ArrowUpFromLine, ShoppingCart, Banknote, Bitcoin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BitcoinBalanceCardProps {
  balance: number | null;
  btcBalance?: number | null;
  fiatValues?: {
    code: string;
    symbol?: string;
    value: string;
  }[];
  className?: string;
  onReceive?: () => void;
  onSend?: () => void;
  onBuy?: () => void;
  onSell?: () => void;
  onActivate?: () => void | Promise<void>;
  isActivated?: boolean;
}

export function BitcoinBalanceCard({
  balance,
  btcBalance,
  fiatValues = [],
  className,
  onReceive,
  onSend,
  onBuy,
  onSell,
  onActivate,
  isActivated = false,
}: BitcoinBalanceCardProps) {
  const displayBalance = btcBalance ?? balance;
  const hasBalance =
    displayBalance !== null &&
    Number.isFinite(Number(displayBalance));

  return (
    <Card
      className={cn(
        "w-[19.2rem] h-40 flex-shrink-0 transition-shadow duration-300 hover:shadow-xl text-primary-foreground rounded-2xl shadow-lg relative overflow-hidden",
        "bg-gradient-to-br from-[#161616] to-[#050505]",
        className
      )}
      style={{
        '--tw-shadow-color': 'hsl(var(--primary) / 0.5)'
      } as React.CSSProperties}
    >
      <Bitcoin className="absolute -right-7 -bottom-10 h-44 w-44 rotate-[-18deg] text-white/[0.055] blur-[1px] pointer-events-none" strokeWidth={1.2} />

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="absolute right-3 top-3 z-30 h-7 min-w-[58px] px-2 text-[10px] font-semibold border-white/20 bg-black/70 text-white hover:bg-white/10 hover:text-white"
        onClick={onActivate}
        disabled={isActivated}
      >
        {isActivated ? "Actif" : "Activer"}
      </Button>

      <CardContent className="p-4 flex flex-col justify-between h-full relative z-10">

        <div>
          <span className="text-base font-semibold text-white">
            Solde Bitcoin
          </span>
        </div>

        <div className="flex-1 flex items-center">
          <div>
            <p className="text-3xl font-bold tracking-tight text-white">
              {hasBalance
                ? `₿ ${Number(displayBalance).toFixed(8)}`
                : '— BTC'}
            </p>

            {fiatValues.length > 0 && (
              <div className="flex items-center gap-3 mt-1">
                {fiatValues.map((item) => (
                  <span
                    key={item.code}
                    className="text-[9px] text-white/55"
                  >
                    ≈ {item.symbol || ''}
                    {item.value} {item.code}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1">
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

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-1 text-[9px] border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            disabled={!isActivated}
            onClick={onBuy}
          >
            <ShoppingCart className="mr-0.5 h-3 w-3" />
            Acheter
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-1 text-[9px] border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            disabled={!isActivated}
            onClick={onSell}
          >
            <Banknote className="mr-0.5 h-3 w-3" />
            Vendre
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}
