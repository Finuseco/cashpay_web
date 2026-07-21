

'use client';

import { useTranslation } from "react-i18next";
import Link from "next/link";
import { TransactionsClient } from "@/components/transactions/transactions-client";
import { Button } from "@/components/ui/button";
import type { User, Currency, Transaction, Card as CardType, Loan } from "@/lib/types";
import { LoanSummary } from "@/components/dashboard/loan-summary";
import { LinkBankAccount } from "@/components/dashboard/link-bank-account";

export function DashboardClient({ user, transactions, currencies, cards, loan }: { user: User | null, transactions: Transaction[], currencies: Currency[], cards: CardType[], loan: Loan | null }) {
  const { t } = useTranslation();
  
  if (!user) {
    return null;
  }
  
  return (
    <main className="flex-1 bg-muted/30 pt-4 pb-20">
        <div className="container mx-auto space-y-6">
            <LoanSummary loan={loan} />
            <LinkBankAccount user={user} />
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-foreground">{t('dashboardRecentTransactions')}</h2>
                    <Button asChild variant="link" className="text-primary px-0">
                    <Link href="/transactions">{t('dashboardViewAll')}</Link>
                    </Button>
                </div>
                <TransactionsClient initialTransactions={transactions} limit={5} />
            </section>
        </div>
    </main>
  );
}
