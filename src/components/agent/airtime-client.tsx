
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, QrCode, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';


const AirtelLogo = () => <div className="flex items-center justify-center h-12 w-24 rounded-md bg-white p-1"><Image src="/logos/airtel.png" alt="Airtel" width={80} height={30} className="object-contain" /></div>;

const ClientSaleFlow = ({ agent }: { agent: User | null }) => {
    const { openAlert } = useAlertDialog();

    const comingSoon = () => {
        openAlert({
            title: "Bientôt disponible",
            description: "Le service d'achat de crédit est en cours de finalisation et sera bientôt activé.",
            variant: "info",
        });
    }

    return (
        <Card className="border-0 shadow-none">
            <CardHeader>
                <CardTitle>Identifier le Client</CardTitle>
                 <CardDescription>Le montant sera débité du portefeuille du client après confirmation par OTP.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6 opacity-60">
                    <div className="space-y-2">
                        <Label>ID Portefeuille du Client</Label>
                        <div className="flex items-center gap-2">
                            <Input placeholder="CP0123456789" disabled />
                            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" disabled><QrCode className="h-4 w-4" /></Button>
                        </div>
                    </div>
                    <Button type="button" variant="gradient" className="w-full" onClick={comingSoon}>
                        Demander l'OTP au client
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

const DirectSaleFlow = ({ agent }: { agent: User | null }) => {
    const { openAlert } = useAlertDialog();
    
    const comingSoon = () => {
        openAlert({
            title: "Bientôt disponible",
            description: "Le service d'achat de crédit est en cours de finalisation et sera bientôt activé.",
            variant: "info",
        });
    }

    return (
        <Card className="border-0 shadow-none">
            <CardHeader>
                <CardTitle>Vente Directe</CardTitle>
                <CardDescription>
                    Pour les clients sans compte CashPay ou pour acheter du crédit pour vous-même. Le montant sera débité de votre portefeuille d'agent.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6 opacity-60">
                    <div className="p-4 border rounded-lg bg-muted/50 flex justify-center">
                        <AirtelLogo/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Numéro de téléphone</Label>
                            <Input type="tel" placeholder="08..." disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>Montant (USD)</Label>
                            <Input type="number" placeholder="5.00" disabled />
                        </div>
                    </div>
                    <Button type="button" variant="gradient" className="w-full" onClick={comingSoon}>Procéder à la confirmation</Button>
                </div>
            </CardContent>
        </Card>
    );
}

export function AgentAirtimeClient({ agent }: { agent: User | null }) {
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
                La fonctionnalité de vente de crédit est en cours de finalisation et sera bientôt disponible.
            </AlertDescription>
        </Alert>
      <Tabs defaultValue="client-sale" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="client-sale">Vente à un client CashPay</TabsTrigger>
            <TabsTrigger value="direct-sale">Vente directe (débit Agent)</TabsTrigger>
        </TabsList>
        <TabsContent value="client-sale" className="pt-2">
            <ClientSaleFlow agent={agent} />
        </TabsContent>
        <TabsContent value="direct-sale" className="pt-2">
            <DirectSaleFlow agent={agent} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
