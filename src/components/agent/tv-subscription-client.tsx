
'use client';

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Info } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";


export function AgentTvSubscriptionClient({ agent }: { agent: User | null }) {
    const { openAlert } = useAlertDialog();

    const comingSoon = () => {
        openAlert({
            title: "Bientôt disponible",
            description: "Le service de réabonnement TV est en cours de finalisation et sera bientôt activé.",
            variant: "info",
        });
    };

    if (!agent) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <Card>
            <Alert variant="info" className="m-4">
                <Info className="h-4 w-4"/>
                <AlertTitle>Service en Maintenance</AlertTitle>
                <AlertDescription>
                    La fonctionnalité de réabonnement TV est en cours de finalisation et sera bientôt disponible.
                </AlertDescription>
            </Alert>
            <CardHeader>
                <CardTitle>Formulaire de Réabonnement</CardTitle>
                <CardDescription>Entrez les informations du client pour procéder au paiement. Le montant sera débité de votre compte agent.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6 opacity-60">
                    <div className="space-y-2">
                        <Label>Opérateur TV</Label>
                        <Select disabled>
                            <SelectTrigger><SelectValue placeholder="Sélectionnez un opérateur"/></SelectTrigger>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Numéro de carte / décodeur</Label>
                        <Input placeholder="000..." disabled />
                    </div>
                    <Button type="button" variant="gradient" className="w-full" onClick={comingSoon}>
                        Payer l'abonnement
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
