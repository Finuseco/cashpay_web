
'use client';
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { SportsEvent } from "@/lib/types";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { cn } from "@/lib/utils";
import { Globe } from 'lucide-react';

export function MatchOddsCard({ event }: { event: SportsEvent }) {
  const { t } = useTranslation();
  const { selections, addBet, removeBet } = useBetSlip();
  const offer = event.offers.find((o) => o.type === "1-n-2");

  if (!offer) return null;

  const handleOddClick = (outcome: any) => {
    const selectionId = `${event.id}-${outcome.id}`;
    const isSelected = selections.some(s => s.id === selectionId);

    if (isSelected) {
      removeBet(selectionId);
    } else {
      addBet({
        id: selectionId,
        matchId: event.id,
        matchName: event.name,
        name: outcome.name,
        odd: outcome.odd,
      });
    }
  };

  return (
    <div className="bg-[#2a3942] rounded-lg p-3 space-y-2">
      <div className="flex justify-between items-center text-xs text-zinc-400">
        <div className="flex items-center gap-2 truncate">
          <Globe className="h-4 w-4"/>
          <span>{event.category.parent?.name} • {event.category.name}</span>
        </div>
        <span>{event.status}</span>
      </div>

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <p className="font-semibold text-sm text-white">{event.team1}</p>
          <p className="font-semibold text-sm text-white">{event.team2}</p>
        </div>
        <div className="flex gap-2">
            {offer.outcomes.map((outcome) => {
                const selectionId = `${event.id}-${outcome.id}`;
                const isSelected = selections.some(s => s.id === selectionId);
                return (
                    <Button
                        key={outcome.id}
                        variant="outline"
                        className={cn(
                            "bg-[#1e293b] border-none hover:bg-zinc-700 w-20 h-9 font-bold text-white rounded-lg",
                            isSelected && "bg-yellow-400 text-black hover:bg-yellow-500"
                        )}
                        onClick={() => handleOddClick(outcome)}
                    >
                        {outcome.odd.toFixed(2)}
                    </Button>
                )
            })}
        </div>
      </div>

      <div className="flex justify-end">
           <a href="#" className="text-xs text-green-400 hover:underline">
              {t('sportsMarketsCount', {count: event.offers.length + 60})}
          </a>
      </div>
    </div>
  );
}
