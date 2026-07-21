'use client';

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight, Utensils, Car, ShoppingCart, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TransactionReceipt } from "@/components/transactions/transaction-receipt";
import type { Transaction } from "@/lib/types";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
                "rounded-full h-9 px-4 text-xs font-bold uppercase", 
                activeFilter === 'All' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
            )}
          >
            {t('transactionsAllFilter')}
          </Button>
          <Button
            key="Income"
            variant={activeFilter === 'Income' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('Income')}
            className={cn("rounded-full h-9 px-4 text-xs font-bold uppercase", activeFilter === 'Income' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}
          >
            {t('transactionsIncomeFilter')}
          </Button>
          <Button
            key="Expense"
            variant={activeFilter === 'Expense' ? 'default' : 'outline'}
            onClick={() => setActiveFilter('Expense')}
            className={cn("rounded-full h-9 px-4 text-xs font-bold uppercase", activeFilter === 'Expense' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}
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
        <div className="space-y-6">
          {Object.entries(groupedTransactions).map(([date, transactions]) => (
            <div key={date}>
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 pl-1">
                {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <div className="space-y-2">
                {transactions.map((transaction, index) => {
                    const isSender = transaction.type === 'sent';
                    const otherPartyName = isSender ? transaction.metadata?.receiverName : transaction.metadata?.senderName;
                    const otherPartyAvatar = isSender ? transaction.metadata?.receiverPhoto : transaction.metadata?.senderPhoto;
                    
                    const nameFallback = (otherPartyName || '??').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                    
                    const iconKey = transaction.metadata?.typeCode?.toLowerCase() || transaction.type;
                    const icon = transactionIcons[iconKey] || (transaction.type === 'sent' ? transactionIcons.sent : transactionIcons.received);
                    
                    return (
                        <div
                        key={index}
                        onClick={() => setSelectedTransaction(transaction)}
                        className="cursor-pointer flex items-center gap-4 bg-card p-3 rounded-xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-primary/10"
                        >
                        <div className="relative">
                            <Avatar className="h-11 w-11 border-2 border-muted shadow-sm">
                                <AvatarImage src={otherPartyAvatar || ''} alt={otherPartyName || 'User'} />
                                <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">{nameFallback}</AvatarFallback>
                            </Avatar>
                            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm border border-muted">
                                {icon}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground truncate">{transaction.description}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-medium mt-0.5">{transaction.time} • {transaction.reference.substring(0, 8)}</p>
                        </div>
                        <div className="text-right">
                            <p
                            className={cn(
                                "font-black text-sm",
                                transaction.type === "sent" ? "text-red-500" : "text-green-500"
                            )}
                            >
                            {transaction.type === "sent" ? "-" : "+"}
                            {parseFloat(transaction.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                            <span className="text-[10px] ml-1 opacity-70">{transaction.currency}</span>
                            </p>
                            {isSender && parseFloat(transaction.fee?.toString() || '0') > 0 && (
                                <p className="text-[9px] text-muted-foreground">Frais: {transaction.currency}{transaction.fee?.toFixed(2)}</p>
                            )}
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
