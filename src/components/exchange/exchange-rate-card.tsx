
'use client';

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import type { ExchangeRate } from "@/lib/actions/exchange.actions";

export function ExchangeRateCard({ rates }: { rates: ExchangeRate[] }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('exchangeRateCardTitle')}</CardTitle>
        <CardDescription>{t('exchangeRateCardDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {rates.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-card">
                <TableHead className="text-center">{t('exchangeRateFrom')}</TableHead>
                <TableHead className="w-8"></TableHead>
                <TableHead className="text-center">{t('exchangeRateTo')}</TableHead>
                <TableHead className="text-right">{t('exchangeRateRate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate, index) => (
                <TableRow key={index}>
                  <TableCell className="text-center font-medium">{rate.from_currency}</TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                  </TableCell>
                  <TableCell className="text-center font-medium">{rate.to_currency}</TableCell>
                  <TableCell className="text-right font-mono">{rate.rate.toFixed(4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-6 text-center text-muted-foreground">
            <p>Les taux de change pour votre région ne sont pas encore disponibles.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
