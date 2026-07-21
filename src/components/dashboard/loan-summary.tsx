

'use client';

import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { Loan } from "@/lib/types";
import { Handshake } from "lucide-react";

const currencySymbols: { [key: string]: string } = {
  USD: "$",
  EUR: "€",
  CDF: "FC",
};

export function LoanSummary({ loan }: { loan: Loan | null }) {
  const { t } = useTranslation();

  if (!loan || (loan.remaining_balance <= 0)) {
    return null; // Don't render anything if there's no active loan
  }

  const progress = (loan.repaid_amount / loan.amount) * 100;
  const symbol = currencySymbols[loan.currency as keyof typeof currencySymbols];

  return (
    <section>
       <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
         <Handshake className="h-6 w-6" />
         {t('loanSummaryTitle')}
       </h2>
       <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 space-y-3">
                <div className="flex justify-between items-baseline text-sm">
                    <p className="text-muted-foreground">{t('loanSummaryRemainingDebt')}</p>
                    <p className="text-muted-foreground">{t('loanSummaryRepaid')} {symbol}{loan.repaid_amount.toFixed(2)}</p>
                </div>
                <p className="text-3xl font-bold text-foreground tracking-tight">
                    {symbol}{loan.remaining_balance.toFixed(2)}
                </p>
                 <Progress value={progress} className="w-full h-2" />
            </div>
            <Button asChild variant="outline" className="shrink-0 mt-2 sm:mt-0 sm:ml-6">
                <Link href="/loan">{t('loanSummaryViewDetails')}</Link>
            </Button>
          </div>
        </CardContent>
       </Card>
    </section>
  );
}
