"use client";

import { useState, useEffect } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const generateAccountNumber = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

interface AccountSummaryProps {
  balance: string;
  currencySymbol: string;
}

export function AccountSummary({ balance, currencySymbol }: AccountSummaryProps) {
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setAccountNumber(generateAccountNumber());
  }, []);

  const copyToClipboard = () => {
    if (accountNumber) {
      navigator.clipboard.writeText(accountNumber);
      toast({
        title: "Copied!",
        description: "Account number copied to clipboard.",
      });
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Account Number</p>
                <div className="flex items-center gap-2">
                    {accountNumber ? (
                    <p className="text-lg font-mono text-foreground">
                        {accountNumber.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')}
                    </p>
                    ) : (
                        <div className="h-6 w-40 bg-muted/20 animate-pulse rounded-md" />
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyToClipboard} disabled={!accountNumber}>
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Copy Account Number</span>
                    </Button>
                </div>
            </div>
            <div className="sm:text-right space-y-1">
                <p className="text-sm text-muted-foreground">Main Balance</p>
                <p className="text-3xl font-bold text-foreground">
                    {currencySymbol}{balance}
                </p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
