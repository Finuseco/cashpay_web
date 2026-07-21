
'use client';

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LoanForm } from "@/components/loan/loan-form";
import type { User, Currency } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, History } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import type { LoanHistory } from "@/lib/actions/loan.actions";
import { Button } from "../ui/button";
import Link from 'next/link';

const checkEligibility = (currencies: Currency[]): boolean => {
  return currencies.some(c => parseFloat(c.balance.replace(/,/g, '')) > 0);
};

function LoanPageSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
            </CardContent>
        </Card>
    );
}

export function LoanPageClient({ user, currencies, loanHistory }: { user: User | null, currencies: Currency[], loanHistory: LoanHistory[] }) {
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const isEligible = checkEligibility(currencies);
  const hasActiveLoan = loanHistory.some(loan => loan.status === 'approved');
  const isFormDisabled = !isEligible || !acceptedTerms || hasActiveLoan;

  if (!isClient) {
      return (
         <main className="flex-1 p-4 md:p-8">
             <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-foreground mb-8 text-center">{t('loanTitle')}</h1>
                <LoanPageSkeleton />
             </div>
         </main>
      );
  }

  return (
    <main className="flex-1 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-foreground">{t('loanTitle')}</h1>
            <Button asChild variant="outline">
              <Link href="/loan/history">
                <History className="mr-2 h-4 w-4" /> {t('loanHistoryButton')}
              </Link>
            </Button>
        </div>
        
        {!isEligible || hasActiveLoan ? (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
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
                <Checkbox id="terms" onCheckedChange={(checked) => setAcceptedTerms(!!checked)} />
                <Label htmlFor="terms" className="cursor-pointer leading-tight">{t('loanAcceptTermsLabel')}</Label>
              </div>
            </CardContent>
          </Card>
        )}

        <fieldset disabled={isFormDisabled} className="disabled:opacity-50">
            <LoanForm user={user} currencies={currencies} />
        </fieldset>
      </div>
    </main>
  );
}
