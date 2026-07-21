
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Satellite, RotateCw, ShieldCheck, Signal, Power } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getClientTerminalInfo, getResellerConfig } from '@/lib/actions/starlink.actions';
import { Badge } from '@/components/ui/badge';
import { rebootTerminal as rebootTerminalApi } from '@/services/starlink';

export function TerminalDetailClient({ terminalId }: { terminalId: string }) {
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    
    const [terminal, setTerminal] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRebooting, setIsRebooting] = useState(false);

    useEffect(() => {
        const fetchTerminal = async () => {
            const userRaw = localStorage.getItem('cashpay-user-profile');
            if (!userRaw) return;
            const user = JSON.parse(userRaw);

            const result = await getClientTerminalInfo(user.id);
            if (result.success && result.data) {
                setTerminal(result.data);
            } else {
                // Si on arrive ici depuis le mode revendeur, on tente de récupérer les infos différemment
                // (Logique simplifiée pour la démo, à enrichir pour les revendeurs gérant plusieurs clients)
                console.log("Chargement en mode gestion directe...");
            }
            setIsLoading(false);
        };
        fetchTerminal();
    }, []);

    const handleReboot = async () => {
        const userRaw = localStorage.getItem('cashpay-user-profile');
        if (!userRaw) return;
        const user = JSON.parse(userRaw);

        setIsRebooting(true);
        try {
            const config = await getResellerConfig(user.id);
            if (!config) throw new Error("Accès non autorisé : configuration revendeur introuvable.");

            // On passe directement les credentials, le service gère le token et le cache.
            await rebootTerminalApi(config.apiKey, config.apiSecret, terminalId);
            
            openAlert({ 
                title: "Commande envoyée", 
                description: "Le terminal Starlink est en cours de redémarrage. La connexion peut être interrompue pendant quelques minutes.", 
                variant: 'success' 
            });
        } catch (e: any) {
            openAlert({ title: "Erreur", description: e.message, variant: 'error' });
        } finally {
            setIsRebooting(false);
        }
    };

    if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;
    
    const displayTerminal = terminal || { nickname: 'Terminal Starlink', dishSerialNumber: 'N/A', status: 'ACTIVE' };

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6 pt-10">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Satellite className="h-6 w-6 text-primary" /> {displayTerminal.nickname}
                    </h1>
                    <p className="text-muted-foreground font-mono text-xs">{displayTerminal.dishSerialNumber}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-zinc-900 text-white border-zinc-800">
                    <div className="flex items-center gap-3">
                        <Signal className="h-5 w-5 text-green-500" />
                        <div>
                            <p className="text-xs opacity-70">Réseau</p>
                            <p className="font-bold">Connecté</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 bg-zinc-900 text-white border-zinc-800">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-blue-500" />
                        <div>
                            <p className="text-xs opacity-70">Statut Service</p>
                            <Badge className="bg-green-500 border-none">{displayTerminal.status}</Badge>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 bg-zinc-900 text-white border-zinc-800">
                    <div className="flex items-center gap-3">
                        <Power className="h-5 w-5 text-orange-500" />
                        <div>
                            <p className="text-xs opacity-70">Alimentation</p>
                            <p className="font-bold">OK</p>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="border-primary/10">
                <CardHeader>
                    <CardTitle>Actions à distance</CardTitle>
                    <CardDescription>Pilotez votre matériel directement depuis CashPay grâce à l'API Enterprise.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/5 transition-colors">
                        <div>
                            <p className="font-bold">Redémarrer le terminal</p>
                            <p className="text-sm text-muted-foreground">Force le redémarrage complet de l'antenne (Dish).</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleReboot} disabled={isRebooting}>
                            {isRebooting ? <Loader2 className="animate-spin h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <Power className="h-5 w-5" /> Zone Critique
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">La suspension du service coupe immédiatement l'accès internet. Seul votre revendeur pourra réactiver le kit via son portail de gestion.</p>
                    <Button variant="destructive" className="w-full">Suspendre le service</Button>
                </CardContent>
            </Card>
        </div>
    );
}
