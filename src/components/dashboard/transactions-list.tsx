

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TransactionReceipt } from "@/components/transactions/transaction-receipt";
import type { Transaction } from "@/lib/types";
import { Button } from "../ui/button";

const transactionIcons = {
  sent: <ArrowUpRight className="h-5 w-5 text-red-400" />,
  received: <ArrowDownLeft className="h-5 w-5 text-green-400" />,
};

const currencySymbols: { [key: string]: string } = {
  EUR: "€",
  USD: "$",
  CDF: "FC",
};

interface TransactionsListProps {
  initialTransactions: Transaction[];
  limit?: number;
}

export function TransactionsList({ initialTransactions, limit }: TransactionsListProps) {
  const { t } = useTranslation();
  const displayTransactions = limit ? initialTransactions.slice(0, limit) : initialTransactions;
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (displayTransactions.length === 0) {
    return (
        <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
                <p>Aucune transaction trouvée.</p>
                <Button variant="link" asChild><Link href="/deposit">Faire un premier dépôt</Link></Button>
            </CardContent>
        </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow className="hover:bg-card">
                    <TableHead className="w-12"></TableHead>
                    <TableHead>{isClient ? t("transactionsListDetails") : "Details"}</TableHead>
                    <TableHead className="text-right">
                    {isClient ? t("transactionsListAmount") : "Amount"}
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-right">
                    {isClient ? t("transactionsListDate") : "Date"}
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-right">
                    {isClient ? t("transactionsListReference") : "Reference"}
                    </TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {displayTransactions.map((transaction, index) => (
                    <TableRow
                    key={index}
                    onClick={() => setSelectedTransaction(transaction)}
                    className="cursor-pointer"
                    >
                    <TableCell>
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/20">
                        {
                            transactionIcons[
                            transaction.type as keyof typeof transactionIcons
                            ]
                        }
                        </span>
                    </TableCell>
                    <TableCell>
                        <div className="font-medium text-card-foreground">
                        {transaction.description}
                        </div>
                        <div className="text-sm text-muted-foreground md:hidden">
                        {transaction.date}
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                        <div
                        className={`font-bold text-card-foreground ${
                            transaction.type === "sent"
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                        >
                        {transaction.type === "sent" ? "-" : "+"}
                        {currencySymbols[transaction.currency]}
                        {transaction.amount}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {isClient ? t('receiptFee', 'Fee') : 'Fee'}: {currencySymbols[transaction.currency]}{(transaction.fee || 0).toFixed(2)}
                        </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-muted-foreground">
                        {transaction.date}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right font-mono text-xs text-muted-foreground">
                        {transaction.reference}
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog
        open={!!selectedTransaction}
        onOpenChange={(isOpen) => !isOpen && setSelectedTransaction(null)}
      >
        <DialogContent className="sm:max-w-md print:shadow-none print:border-none print:p-0">
          <DialogHeader className="print:hidden">
            <DialogTitle>{isClient ? t("transactionReceiptTitle") : "Transaction Details"}</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <TransactionReceipt transaction={selectedTransaction} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
