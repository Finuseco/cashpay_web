'use client';

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoanForm } from "@/components/loan/loan-form";
import type { User, Currency } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, History } from "lucide-react";
import { processLoanRepayments, getLoanInterestRates } from "@/lib/actions/loan.actions";
import type { LoanHistory } from "@/lib/actions/loan.actions";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import Link from 'next/link';

const defaultDurations = (repaidCount: number) =>
  repaidCount <= 0 ? [1] : repaidCount === 1 ? [1, 3] : repaidCount === 2 ? [1, 3, 6] : repaidCount === 3 ? [1, 3, 6, 12] : [1, 3, 6, 12, 24];

const checkEligibility = (currencies: Currency[]): boolean => {
  return currencies.some(c => parseFloat(c.balance.replace(/,/g, '')) > 0);
};

export function LoanPageClient({ user, currencies, loanHistory }: { user: User | null, currencies: Currency[], loanHistory: LoanHistory[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [interestRates, setInterestRates] = useState<Record<number, number>>({ 1: 24, 3: 21, 6: 21, 12: 21, 24: 21 });

  // À l’entrée sur LoanMe, on ne traite que les échéances déjà arrivées à échéance.
  // Le traitement est ciblé sur cet utilisateur afin d’éviter une requête globale coûteuse.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const result = await processLoanRepayments(user.id);
      if (!cancelled && result.success && result.processed > 0) router.refresh();
    })();
    return () => { cancelled = true; };
  }, [user?.id, router]);

  useEffect(() => {
    getLoanInterestRates().then(rates => setInterestRates(rates)).catch(() => {});
  }, []);

  const isEligible = checkEligibility(currencies);
  const hasActiveLoan = loanHistory.some(loan => ['pending', 'approved'].includes(String(loan.status).toLowerCase()));
  const repaidCount = loanHistory.filter(loan => String(loan.status).toLowerCase() === 'repaid').length;
  const durations = defaultDurations(repaidCount);
  const lastRepaid = [...loanHistory].filter(loan => String(loan.status).toLowerCase() === 'repaid').sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0];
  const interestRate = Number(lastRepaid?.interest_rate) > 0 ? Number(lastRepaid.interest_rate) : (interestRates[durations[0]] ?? 21);
  const isFormDisabled = !isEligible || !acceptedTerms || hasActiveLoan;

  return (
    <main className="flex-1 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-bold text-foreground">{t('loanTitle')}</h1>
          <div className="flex w-full max-w-md flex-row items-center justify-center gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link href="/loan/repayment">Remboursement</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/loan/history">
                <History className="mr-2 h-4 w-4" /> {t('loanHistoryButton')}
              </Link>
            </Button>
          </div>
        </div>

        {!isEligible || hasActiveLoan ? (
          <Alert className="border-primary/20 bg-primary/5">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <AlertTitle>{hasActiveLoan ? t('loanActiveLoanTitle') : t('loanEligibilityErrorTitle')}</AlertTitle>
            <AlertDescription>
              {hasActiveLoan ? t('loanActiveLoanDescription') : t('loanEligibilityErrorDescription')}
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t('loanTermsTitle')}</CardTitle>
              <CardDescription>{t('loanTermsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-32 overflow-y-auto border p-4 rounded-md text-sm text-muted-foreground space-y-2 bg-muted/50">
                <p>{t('loanTerm1')}</p>
                <p>{t('loanTerm2')}</p>
                <p>{t('loanTerm3')}</p>
                <p>{t('loanTerm4')}</p>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)} />
                <Label htmlFor="terms" className="cursor-pointer leading-tight">{t('loanAcceptTermsLabel')}</Label>
              </div>
            </CardContent>
          </Card>
        )}

        <fieldset disabled={isFormDisabled} className="disabled:opacity-50">
          <LoanForm user={user} currencies={currencies} interestRate={interestRate} interestRates={interestRates} durations={durations} />
        </fieldset>
      </div>
    </main>
  );
}
