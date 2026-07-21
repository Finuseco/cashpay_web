
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Satellite, Loader2, User, Briefcase, PlusCircle, Wrench, ShieldCheck, Info } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { linkStarlinkResellerAccount, getTerminalsForReseller, linkClientStarlinkAccount, getClientTerminalInfo } from '@/lib/actions/starlink.actions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function StarlinkDashboardClient() {
    const { t } = useTranslation();
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    
    const [isLoading, setIsLoading] = useState(true);
    const [terminals, setTerminals] = useState<any[]>([]);
    const [clientKit, setClientKit] = useState<any>(null);
    const [isReseller, setIsReseller] = useState(false);

    // États du formulaire revendeur
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    
    // État du formulaire client
    const [kitSerial, setKitSerial] = useState('');

    useEffect(() => {
        const checkStatus = async () => {
            const userRaw = localStorage.getItem('cashpay-user-profile');
            if (!userRaw) return;
            const user = JSON.parse(userRaw);

            // Vérifier si c'est un revendeur
            const resResult = await getTerminalsForReseller(user.id);
            if (resResult.success) {
                setTerminals(resResult.data || []);
                setIsReseller(true);
            }

            // Vérifier si c'est un client
            const clientResult = await getClientTerminalInfo(user.id);
            if (clientResult.success) {
                setClientKit(clientResult.data);
            }
            setIsLoading(false);
        };
        checkStatus();
    }, []);

    const handleResellerLink = async () => {
        const userRaw = localStorage.getItem('cashpay-user-profile');
        if (!userRaw) return;
        setIsLoading(true);
        const result = await linkStarlinkResellerAccount(JSON.parse(userRaw), { apiKey, apiSecret });
        if (result.success) {
            openAlert({ title: "Compte lié", description: `Le compte Starlink "${result.accountName}" a été synchronisé.`, variant: 'success' });
            window.location.reload();
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
        setIsLoading(false);
    };

    const handleClientLink = async () => {
        const userRaw = localStorage.getItem('cashpay-user-profile');
        if (!userRaw) return;
        setIsLoading(true);
        const result = await linkClientStarlinkAccount(JSON.parse(userRaw).id, kitSerial);
        if (result.success) {
            openAlert({ title: "Kit lié", description: "Votre kit Starlink est maintenant synchronisé avec CashPay.", variant: 'success' });
            window.location.reload();
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
        setIsLoading(false);
    };

    if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;

    return (
        <div className="max-w-5xl mx-auto p-4 space-y-8">
            <div className="text-center">
                <h1 className="text-4xl font-bold flex items-center justify-center gap-3 text-foreground">
                    <Satellite className="h-10 w-10 text-primary" /> Starlink Enterprise
                </h1>
                <p className="text-muted-foreground mt-2 text-lg">Gestion centralisée de votre connectivité satellite.</p>
            </div>

            <Tabs defaultValue={isReseller ? "reseller" : "client"} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
                    <TabsTrigger value="client"><User className="mr-2 h-4 w-4"/> Client</TabsTrigger>
                    <TabsTrigger value="reseller"><Briefcase className="mr-2 h-4 w-4"/> Revendeur</TabsTrigger>
                </TabsList>

                <TabsContent value="client">
                    {clientKit ? (
                        <Card className="border-primary/20 shadow-lg">
                            <CardHeader className="bg-muted/50 border-b">
                                <div className="flex justify-between items-center">
                                    <CardTitle>Mon Terminal Starlink</CardTitle>
                                    <Badge className={clientKit.status === 'ACTIVE' ? 'bg-green-500' : 'bg-zinc-500'}>{clientKit.status}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase">Surnom</p>
                                        <p className="font-bold">{clientKit.nickname || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase">N° de Série</p>
                                        <p className="font-mono text-sm">{clientKit.dishSerialNumber}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase">Plan de service</p>
                                        <p className="font-semibold">{clientKit.servicePlanId || 'Standard'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground uppercase">Statut API</p>
                                        <p className="font-bold text-green-500">Connecté</p>
                                    </div>
                                </div>
                                <Button className="w-full" variant="outline" onClick={() => router.push(`/starlink/terminal/${clientKit.userTerminalId}`)}>
                                    <Wrench className="mr-2 h-4 w-4" /> Accéder au panneau de contrôle
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>Lier mon Kit Starlink</CardTitle>
                                <CardDescription>Associez votre matériel Starlink à votre compte CashPay pour le gérer à distance.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Numéro de série du Kit (SN)</Label>
                                    <Input placeholder="KIT00000000" value={kitSerial} onChange={(e) => setKitSerial(e.target.value)} />
                                </div>
                                <Button className="w-full" onClick={handleClientLink}>Vérifier et Lier</Button>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="reseller">
                    {terminals.length > 0 ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="p-4 bg-primary text-white">
                                    <p className="text-sm opacity-80">Terminaux Gérés</p>
                                    <p className="text-3xl font-bold">{terminals.length}</p>
                                </Card>
                                <Card className="p-4 border-primary/20">
                                    <p className="text-sm text-muted-foreground">Statut Connexion API</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
                                        <p className="font-bold">Actif</p>
                                    </div>
                                </Card>
                                <Button className="h-full" variant="outline" onClick={() => router.push('/starlink/install')}>
                                    <PlusCircle className="mr-2 h-5 w-5" /> Nouvelle Installation
                                </Button>
                            </div>

                            <Card>
                                <CardHeader><CardTitle>Inventaire de la Flotte</CardTitle></CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Surnom / Client</TableHead>
                                                <TableHead>SN Kit</TableHead>
                                                <TableHead>Statut</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {terminals.map(t => (
                                                <TableRow key={t.userTerminalId}>
                                                    <TableCell className="font-semibold">{t.nickname || 'Sans nom'}</TableCell>
                                                    <TableCell className="font-mono text-xs">{t.dishSerialNumber}</TableCell>
                                                    <TableCell><Badge variant="outline" className={t.status === 'ACTIVE' ? 'border-green-500 text-green-600' : ''}>{t.status}</Badge></TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" variant="ghost" onClick={() => router.push(`/starlink/terminal/${t.userTerminalId}`)}><Wrench className="h-4 w-4"/></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <Card className="max-w-2xl mx-auto border-primary/20">
                            <CardHeader>
                                <CardTitle>Configuration de l'API Enterprise</CardTitle>
                                <CardDescription>Connectez votre compte Starlink Enterprise pour gérer votre flotte de clients.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Alert className="bg-primary/5 border-primary/10">
                                    <Info className="h-4 w-4 text-primary" />
                                    <AlertTitle>Sécurité des données</AlertTitle>
                                    <AlertDescription>Vos clés API sont stockées de manière sécurisée et ne sont utilisées que pour communiquer avec Starlink au nom de vos clients.</AlertDescription>
                                </Alert>
                                <div className="space-y-2">
                                    <Label>Starlink Client ID</Label>
                                    <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Starlink Client Secret</Label>
                                    <Input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
                                </div>
                                <Button className="w-full" variant="gradient" onClick={handleResellerLink}>Se connecter au réseau Starlink</Button>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
