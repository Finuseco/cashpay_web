

'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight, Search, Calendar as CalendarIcon, Utensils, Car, ShoppingCart, Download, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TransactionReceipt } from "@/components/transactions/transaction-receipt";
import type { Transaction } from "@/lib/types";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

const transactionIcons: { [key: string]: React.ReactElement } = {
  sent: <ArrowUpRight className="h-5 w-5 text-red-500" />,
  received: <ArrowDownLeft className="h-5 w-5 text-green-500" />,
  grocery: <Utensils className="h-5 w-5 text-foreground" />,
  transport: <Car className="h-5 w-5 text-foreground" />,
  pos_sale: <ShoppingCart className="h-5 w-5 text-foreground" />,
  dp: <ArrowDownLeft className="h-5 w-5 text-green-500" />,
  wd: <ArrowUpRight className="h-5 w-5 text-red-500" />,
  bill: <DollarSign className="h-5 w-5 text-foreground" />
};

const currencySymbols: { [key: string]: string } = {
  EUR: "€",
  USD: "$",
  CDF: "FC",
};

interface TransactionsClientProps {
  initialTransactions: Transaction[];
  limit?: number;
}

export function TransactionsClient({ initialTransactions, limit }: TransactionsClientProps) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  const filteredTransactions = initialTransactions.filter(transaction => {
      if (activeFilter === 'Income') return transaction.type === 'received';
      if (activeFilter === 'Expense') return transaction.type === 'sent';
      return true;
  });

  const displayTransactions = limit ? filteredTransactions.slice(0, limit) : filteredTransactions;

  const groupedTransactions = displayTransactions.reduce((acc, transaction) => {
    const date = new Date(transaction.date.split('/').reverse().join('-')).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <>
      <div className="flex space-x-2 mb-4">
        <Button
            key="All"
            variant={activeFilter === 'All' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('All')}
            className={cn(
                "rounded-full", 
                activeFilter === 'All' ? "bg-primary/20 text-primary border-primary/30" : "bg-card border-card"
            )}
          >
            {t('transactionsAllFilter')}
          </Button>
          <Button
            key="Income"
            variant={activeFilter === 'Income' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('Income')}
            className={cn("rounded-full", activeFilter === 'Income' ? "bg-primary/20 text-primary border-primary/30" : "bg-card border-card")}
          >
            {t('transactionsIncomeFilter')}
          </Button>
          <Button
            key="Expense"
            variant={activeFilter === 'Expense' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('Expense')}
            className={cn("rounded-full", activeFilter === 'Expense' ? "bg-primary/20 text-primary border-primary/30" : "bg-card border-card")}
          >
            {t('transactionsExpenseFilter')}
          </Button>
      </div>

       {displayTransactions.length === 0 ? (
          <Card className="shadow-none border-none bg-transparent">
              <CardContent className="p-8 text-center text-muted-foreground">
                  <p>{t('noTransactionsFound')}</p>
              </CardContent>
          </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedTransactions).map(([date, transactions]) => (
            <div key={date}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
              <div className="space-y-2">
                {transactions.map((transaction, index) => {
                    const iconKey = transaction.metadata?.typeCode?.toLowerCase() || transaction.type;
                    const icon = transactionIcons[iconKey] || (transaction.type === 'sent' ? transactionIcons.sent : transactionIcons.received);
                    
                    return (
                        <div
                        key={index}
                        onClick={() => setSelectedTransaction(transaction)}
                        className="cursor-pointer flex items-center gap-4 bg-card p-4 rounded-xl shadow-sm"
                        >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            {icon}
                        </span>
                        <div className="flex-1">
                            <p className="font-semibold text-foreground">{transaction.description}</p>
                            <p className="text-sm text-muted-foreground">{transaction.time}</p>
                        </div>
                        <div className="text-right">
                            <p
                            className={`font-bold ${
                                transaction.type === "sent"
                                ? "text-red-500"
                                : "text-green-500"
                            }`}
                            >
                            {transaction.type === "sent" ? "-" : "+"}
                            {transaction.currency}
                            {transaction.amount}
                            </p>
                        </div>
                        </div>
                    );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog
        open={!!selectedTransaction}
        onOpenChange={(isOpen) => !isOpen && setSelectedTransaction(null)}
      >
        <DialogContent className="sm:max-w-md print:shadow-none print:border-none print:p-0">
          <DialogHeader className="print:hidden">
            <DialogTitle>{t("transactionReceiptTitle")}</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <TransactionReceipt transaction={selectedTransaction} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

    