
"use client";

import { useBetSlip } from "@/hooks/use-bet-slip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { BetSelection } from "@/lib/types";

function BetSlipItem({ selection }: { selection: BetSelection }) {
  const { removeBet } = useBetSlip();

  return (
    <div className="text-sm p-3 bg-zinc-800 rounded-md">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold">{selection.matchName}</p>
          <p className="text-xs text-zinc-400">
            1x2 / Vainqueur du match:{" "}
            <span className="font-semibold text-white">{selection.name}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-zinc-400 hover:text-red-500"
          onClick={() => removeBet(selection.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex justify-end items-center mt-1">
        <span className="font-bold text-lg text-yellow-400">
          {selection.odd.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function BetSlipSheet() {
  const { t } = useTranslation();
  const { open, setOpen, selections, clearBets } = useBetSlip();
  const [stake, setStake] = useState(1000);
  const { openAlert } = useAlertDialog();

  const totalOdds = useMemo(() => {
    if (selections.length === 0) return 0;
    return selections.reduce((acc, s) => acc * s.odd, 1);
  }, [selections]);

  const potentialWinnings = useMemo(() => {
    return stake * totalOdds;
  }, [stake, totalOdds]);

  const handlePlaceBet = () => {
    if (selections.length === 0) return;
    openAlert({
        variant: "success",
        title: 'Pari Placé !',
        description: `Votre pari de ${stake.toLocaleString()} CDF a été placé avec succès. Gains potentiels : ${potentialWinnings.toFixed(2)} CDF.`
    })
    clearBets();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="bg-zinc-900 border-l-zinc-700 text-white p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-zinc-700">
          <SheetTitle>{t("betSlipTitle")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {selections.length > 0 ? (
              selections.map((selection) => (
                <BetSlipItem key={selection.id} selection={selection} />
              ))
            ) : (
              <div className="text-center text-zinc-400 py-16">
                <p>{t("betSlipEmpty")}</p>
                <p className="text-xs">
                  {t("betSlipEmptyHint")}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {selections.length > 0 && (
          <SheetFooter className="p-4 border-t border-zinc-700 bg-zinc-900 space-y-4">
            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-zinc-400">{t('betSlipSelections', {count: selections.length})}</span>
                    <span className="font-bold">{totalOdds.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <Label htmlFor="stake" className="text-zinc-400">{t('betSlipStake')}</Label>
                    <Input 
                        id="stake"
                        type="number"
                        value={stake}
                        onChange={(e) => setStake(Number(e.target.value))}
                        className="w-28 h-8 bg-zinc-800 border-zinc-700"
                    />
                </div>
                <div className="flex justify-between text-lg">
                    <span className="text-zinc-400">{t('betSlipPotentialWinnings')}</span>
                    <span className="font-bold text-yellow-400">{potentialWinnings.toFixed(2)} CDF</span>
                </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={clearBets}
                className="w-full bg-zinc-700 border-zinc-600 hover:bg-zinc-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("betSlipClear")}
              </Button>
              <SheetClose asChild>
                <Button variant="default" className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-bold" onClick={handlePlaceBet}>
                    {t("betSlipPlaceBet")}
                </Button>
              </SheetClose>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
