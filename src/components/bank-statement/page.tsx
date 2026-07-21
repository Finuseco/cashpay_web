
'use client';

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon, Download, Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { Label } from "@/components/ui/label";
import { requestBankStatement } from "@/lib/actions/statement.actions";
import { calculateTransactionFee } from "@/lib/actions/wallet.actions";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import type { User } from "@/lib/types";

export default function BankStatementPage() {
    const [date, setDate] = useState<DateRange | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    const [statementFee, setStatementFee] = useState<number | null>(null);
    const { openAlert } = useAlertDialog();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const fetchUserAndFee = async () => {
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
            if(fetchedUser) {
                const fee = await calculateTransactionFee(1, 'USD', 'FE', fetchedUser.country); // Amount doesn't matter for fixed fee
                setStatementFee(fee);
            }
        };
        fetchUserAndFee();
    }, []);

    const handleRequestStatement = async () => {
        if (!date || !date.from || !date.to) {
            openAlert({
                title: "Période Invalide",
                description: "Veuillez sélectionner une période de début et de fin.",
                variant: 'warning'
            });
            return;
        }

        if (statementFee === null) {
            openAlert({ title: "Erreur", description: "Impossible de récupérer les frais de service.", variant: 'error' });
            return;
        }

        setIsLoading(true);
        const result = await requestBankStatement({ startDate: date.from, endDate: date.to, fee: statementFee });
        setIsLoading(false);

        if (result.success) {
            openAlert({
                title: "Relevé en cours de génération",
                description: `Votre relevé pour la période du ${format(date.from, "PPP", { locale: fr })} au ${format(date.to, "PPP", { locale: fr })} vous sera envoyé par email. Des frais de ${statementFee.toFixed(2)} USD ont été débités.`,
                variant: 'success'
            });
            setDate(undefined);
        } else {
             openAlert({
                title: "Échec de la demande",
                description: result.error,
                variant: 'error'
            });
        }
    };

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-2xl mx-auto">
                     <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-foreground">Relevés Bancaires</h1>
                        <p className="mt-2 text-lg text-muted-foreground">Demandez et téléchargez vos relevés de compte.</p>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Demander un Relevé</CardTitle>
                            <CardDescription>
                                Sélectionnez une période pour générer votre relevé de compte. 
                                {statementFee !== null ? ` Des frais de $${statementFee.toFixed(2)} s'appliquent par demande.` : ' Chargement des frais...'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Période du relevé</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date?.from ? (
                                        date.to ? (
                                            <>
                                            {format(date.from, "dd LLL, y", { locale: fr })} -{" "}
                                            {format(date.to, "dd LLL, y", { locale: fr })}
                                            </>
                                        ) : (
                                            format(date.from, "dd LLL, y", { locale: fr })
                                        )
                                        ) : (
                                        <span>Choisissez une période</span>
                                        )}
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={date?.from}
                                        selected={date}
                                        onSelect={setDate}
                                        numberOfMonths={2}
                                    />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={handleRequestStatement} disabled={!date || isLoading || statementFee === null}>
                                {isLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                )}
                                Demander le relevé
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </DashboardLayout>
    );
}
