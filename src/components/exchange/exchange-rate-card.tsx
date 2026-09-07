'use client';

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Info } from "lucide-react";
import type { ExchangeRate } from "@/lib/actions/exchange.actions";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

export function ExchangeRateCard({ rates }: { rates: ExchangeRate[] }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
        <Alert className="bg-primary/5 border-primary/10">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-xs font-bold uppercase tracking-widest text-primary">Information Taux</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
                Ces taux sont fournis à titre indicatif par le réseau souverain. Les taux réels de conversion sont garantis lors du calcul final avant validation par PIN.
            </AlertDescription>
        </Alert>

        <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
            <CardTitle>Grille de Taux Indicative</CardTitle>
            <CardDescription>Valeurs actuelles du marché pour votre zone.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            {rates.length > 0 ? (
            <Table>
                <TableHeader>
                <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-center font-bold text-[10px] uppercase">Source</TableHead>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-center font-bold text-[10px] uppercase">Destination</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase">Valeur Indicative</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {rates.map((rate, index) => (
                    <TableRow key={index} className="border-zinc-50">
                    <TableCell className="text-center font-black text-sm">{rate.from_currency}</TableCell>
                    <TableCell>
                        <ArrowRight className="h-3 w-3 text-muted-foreground mx-auto" />
                    </TableCell>
                    <TableCell className="text-center font-black text-sm">{rate.to_currency}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold text-primary">{rate.rate.toFixed(4)}</TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            ) : (
            <div className="p-10 text-center text-muted-foreground italic text-sm">
                <p>Récupération des taux en cours ou zone non configurée...</p>
            </div>
            )}
        </CardContent>
        </Card>
    </div>
  );
}
