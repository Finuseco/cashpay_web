

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Satellite, Info, Loader2, User, Briefcase, PlusCircle, Wrench, BarChart3, CloudCog, AlertCircle } from 'lucide-react';
import type { User as UserType } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getStarlinkAccountInfo, getTerminalsForAccount, linkStarlinkResellerAccount, getResellerConfig, getBillingCycles, getStarlinkAlerts, acknowledgeStarlinkAlert, setLocalContentCaching, batchConfigureTerminals, linkClientStarlinkAccount } from '@/lib/actions/starlink.actions';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ResellerApiCredentials } from '@/lib/types';
import { Switch } from '../ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTranslation } from "react-i18next";
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

const resellerApiSchema = z.object({
  apiKey: z.string().min(10, "La clé API est requise."),
  apiSecret: z.string().min(10, "La clé secrète est requise."),
});

interface Terminal {
    id: string;
    nickname: string;
    dishSerialNumber: string;
    status: string;
}

const SyncStatus = ({ status, progress }: { status: string; progress: number }) => (
    <div className="text-center space-y-4 p-8">
        <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
        <p className="text-lg font-semibold">{status}</p>
        <Progress value={progress} className="w-full" />
    </div>
);

const ClientView = ({ user }: { user: UserType | null }) => {
    const { t } = useTranslation();
    const [linkedAccount, setLinkedAccount] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [terminals, setTerminals] = useState<Terminal[]>([]);
    const [kitInput, setKitInput] = useState('');
    
    const { openAlert } = useAlertDialog();
    const router = useRouter();

    const fetchTerminals = useCallback(async (accountId: string) => {
        const result = await getTerminalsForAccount({ accountId });
        if (result.success && result.data) {
            setTerminals(result.data);
        }
    }, []);

    const handleLinkAccount = async () => {
        if (!kitInput || !user) return;
        setIsLoading(true);
        const result = await getStarlinkAccountInfo(kitInput);
        if (result.success && result.data) {
            setLinkedAccount(result.data);
            await linkClientStarlinkAccount(user.id, kitInput, result.data.accountId, result.data.serviceId);
            await fetchTerminals(result.data.accountId);
            openAlert({ variant: 'success', title: 'Compte Lié', description: `Votre kit Starlink a été lié à votre compte CashPay.` });
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error || 'Impossible de lier le compte.' });
        }
        setIsLoading(false);
    };
    
    useEffect(() => {
        const fetchLinkedAccount = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            const accountInfo = await getStarlinkAccountInfo(null, undefined, user.id);
            if (accountInfo.success && accountInfo.data) {
                setLinkedAccount(accountInfo.data);
                await fetchTerminals(accountInfo.data.accountId);
            }
            setIsLoading(false);
        };
        fetchLinkedAccount();
    }, [user, fetchTerminals]);
    
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleLinkAccount();
    }

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>
    }

    if (!linkedAccount) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('linkStarlinkKitTitle')}</CardTitle>
                        <CardDescription>{t('linkStarlinkKitDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <form onSubmit={handleFormSubmit} className="flex gap-2">
                           <Input placeholder={t('linkStarlinkKitPlaceholder')} value={kitInput} onChange={(e) => setKitInput(e.target.value)} />
                           <Button type="submit" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" /> : t('linkButton')}</Button>
                       </form>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                    {t('myStarlinkTerminalsTitle')}
                </h2>
                <p className="text-muted-foreground mt-1">{t('accountManagementLabel')} {linkedAccount.accountId}</p>
            </div>
            
            <Card>
                <CardHeader><CardTitle>{t('terminalListTitle')}</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>{t('nicknameColumn')}</TableHead><TableHead>{t('serialNumberColumn')}</TableHead><TableHead>{t('statusColumn')}</TableHead><TableHead className="text-right">{t('actionsColumn')}</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {terminals.map(terminal => (
                                <TableRow key={terminal.id}>
                                    <TableCell>{terminal.nickname}</TableCell>
                                    <TableCell className="font-mono">{terminal.dishSerialNumber}</TableCell>
                                    <TableCell><Badge className={terminal.status === 'ACTIVE' ? 'bg-green-600' : 'bg-zinc-500'}>{terminal.status}</Badge></TableCell>
                                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => router.push(`/starlink/terminal/${terminal.id}`)}><Wrench className="mr-2 h-4 w-4"/> {t('manageButton')}</Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>{t('paymentTitle')}</CardTitle></CardHeader>
                <CardContent><Button asChild className="w-full"><Link href="/starlink/payment">{t('paySubscriptionButton')}</Link></Button></CardContent>
            </Card>
        </div>
    );
};

const ResellerView = ({ user }: { user: UserType | null }) => {
    const { t } = useTranslation();
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    
    const [resellerConfig, setResellerConfig] = useState<ResellerApiCredentials | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<string | null>(null);
    const [syncProgress, setSyncProgress] = useState(0);

    const [terminals, setTerminals] = useState<Terminal[]>([]);
    const [billingCycles, setBillingCycles] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [selectedTerminalIds, setSelectedTerminalIds] = useState<Set<string>>(new Set());
    const [isBatchConfigureOpen, setIsBatchConfigureOpen] = useState(false);
    const [selectedBatchPlan, setSelectedBatchPlan] = useState('');
    const [isApiUpdateOpen, setIsApiUpdateOpen] = useState(false);

    
    const apiForm = useForm<z.infer<typeof resellerApiSchema>>({
        resolver: zodResolver(resellerApiSchema),
        defaultValues: { apiKey: '', apiSecret: '' },
    });

    const fetchResellerData = useCallback(async (config: ResellerApiCredentials) => {
        setIsLoading(true);
        setSyncStatus(t('syncingStatusFetching'));
        setSyncProgress(75);
        const [terminalsResult, billingResult, alertsResult] = await Promise.all([ 
            getTerminalsForAccount(config), 
            getBillingCycles(config),
            getStarlinkAlerts(config)
        ]);
        if (terminalsResult.success && terminalsResult.data) setTerminals(terminalsResult.data);
        if (billingResult.success && billingResult.data) setBillingCycles(billingResult.data);
        if (alertsResult.success && alertsResult.data) setAlerts(alertsResult.data);
        setSyncProgress(100);
        await new Promise(r => setTimeout(r, 500));
        setSyncStatus(null);
        setIsLoading(false);
    }, [t]);

    useEffect(() => {
        const checkExistingConfig = async () => {
             if(!user) { setIsLoading(false); return; }
             const storedConfig = await getResellerConfig(user.id);
             if (storedConfig) {
                 setResellerConfig(storedConfig);
                 await fetchResellerData(storedConfig);
             } else {
                 setIsLoading(false); 
             }
        };
        checkExistingConfig();
    }, [user, fetchResellerData]);
    
    const handleApiSubmit = async (values: z.infer<typeof resellerApiSchema>) => {
        if (!user) return;
        
        setIsActionLoading(true);
        setSyncStatus(t('syncingStatusValidating'));
        setSyncProgress(25);
        
        const result = await linkStarlinkResellerAccount(user, { ...values, accountId: '' });
        
        if (result.success && result.config) {
            setSyncStatus(t('syncingStatusFound', {accountName: result.accountName}));
            setSyncProgress(60);
            
            setResellerConfig(result.config);
            await fetchResellerData(result.config);
            setIsApiUpdateOpen(false); // Close dialog on success
        } else {
            openAlert({ title: "Échec de la connexion", description: result.error, variant: 'error' });
            setSyncStatus(null);
        }
        setIsActionLoading(false);
    };

    const handleBatchConfigure = async () => {
        if (!resellerConfig || selectedTerminalIds.size === 0 || !selectedBatchPlan) return;
        setIsActionLoading(true);
        const result = await batchConfigureTerminals(resellerConfig, Array.from(selectedTerminalIds), { servicePlanId: selectedBatchPlan });
        if(result.success) {
            openAlert({ title: 'Succès', description: 'La configuration par lots a été appliquée.' });
            setIsBatchConfigureOpen(false);
            setSelectedTerminalIds(new Set());
            fetchResellerData(resellerConfig); // Refresh data
        } else {
            openAlert({ title: 'Erreur', description: result.error });
        }
        setIsActionLoading(false);
    }
    
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedTerminalIds(new Set(terminals.map(t => t.id)));
        } else {
            setSelectedTerminalIds(new Set());
        }
    }

    const handleSelectRow = (terminalId: string, checked: boolean) => {
        const newSelection = new Set(selectedTerminalIds);
        if (checked) {
            newSelection.add(terminalId);
        } else {
            newSelection.delete(terminalId);
        }
        setSelectedTerminalIds(newSelection);
    }

    if (isLoading && !resellerConfig) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>
    }

    if (!resellerConfig) {
        return (
            <AnimatePresence mode="wait">
                <motion.div
                    key={syncStatus ? 'syncing' : 'form'}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                >
                    {syncStatus ? (
                        <Card className="max-w-2xl mx-auto"><CardContent className="p-0"><SyncStatus status={syncStatus} progress={syncProgress} /></CardContent></Card>
                    ) : (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <Alert><Info className="h-4 w-4" /><AlertTitle>{t('resellerServiceAlertTitle')}</AlertTitle><AlertDescription>{t('resellerServiceAlertDescription')}</AlertDescription></Alert>
                            <Card>
                                <CardHeader><CardTitle>{t('connectResellerAccountTitle')}</CardTitle><CardDescription>{t('connectResellerAccountDescription')}</CardDescription></CardHeader>
                                <CardContent>
                                    <Form {...apiForm}><form onSubmit={apiForm.handleSubmit(handleApiSubmit)} className="space-y-4">
                                        <FormField control={apiForm.control} name="apiKey" render={({ field }) => ( <FormItem><FormLabel>{t('apiKeyLabel')}</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                        <FormField control={apiForm.control} name="apiSecret" render={({ field }) => ( <FormItem><FormLabel>{t('apiSecretLabel')}</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                        <Button type="submit" variant="gradient" className="w-full" disabled={isActionLoading}>
                                            {isActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} {t('connectAndSyncButton')}
                                        </Button>
                                    </form></Form>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        );
    }
    
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div><h2 className="text-2xl font-bold">{t('resellerManagementTitle')}</h2><p className="text-muted-foreground">{t('resellerAccountLabel')}: {resellerConfig.accountId} ({t('resellerPlanLabel')})</p></div>
                <div className="flex gap-2"><Button onClick={() => router.push('/starlink/install')}><PlusCircle className="mr-2 h-4 w-4"/> {t('orderInstallationButton')}</Button></div>
            </div>
             <Tabs defaultValue="terminals">
                <TabsList>
                    <TabsTrigger value="terminals"><Wrench className="mr-2 h-4 w-4"/>{t('terminalsTab')}</TabsTrigger>
                    <TabsTrigger value="alerts"><AlertCircle className="mr-2 h-4 w-4"/>{t('alertsTab')}</TabsTrigger>
                    <TabsTrigger value="billing"><BarChart3 className="mr-2 h-4 w-4"/>{t('billingTab')}</TabsTrigger>
                    <TabsTrigger value="settings"><CloudCog className="mr-2 h-4 w-4"/>{t('settingsTab')}</TabsTrigger>
                </TabsList>
                 <TabsContent value="terminals" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>{t('resellerTerminalListTitle', {count: terminals.length})}</CardTitle>
                            <div className="flex items-center gap-2">
                                <Dialog open={isBatchConfigureOpen} onOpenChange={setIsBatchConfigureOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" disabled={selectedTerminalIds.size === 0}><Wrench className="mr-2 h-4 w-4"/>{t('batchActionsButton', {count: selectedTerminalIds.size})}</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>{t('batchConfigTitle')}</DialogTitle><DialogDescription>{t('batchConfigDescription', {count: selectedTerminalIds.size})}</DialogDescription></DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <Label>{t('newServicePlanLabel')}</Label>
                                        <Select onValueChange={setSelectedBatchPlan}><SelectTrigger><SelectValue placeholder={t('choosePlanPlaceholder')}/></SelectTrigger><SelectContent><SelectItem value="prd_mobile_regional">Mobile Regional</SelectItem><SelectItem value="prd_mobile_priority">Mobile Priority 50GB</SelectItem></SelectContent></Select>
                                    </div>
                                    <DialogFooter><Button onClick={handleBatchConfigure} disabled={isActionLoading || !selectedBatchPlan}>{t('applyChangesButton')}</Button></DialogFooter>
                                </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader><TableRow>
                                <TableHead className="w-10"><Checkbox onCheckedChange={(checked) => handleSelectAll(Boolean(checked))} checked={selectedTerminalIds.size === terminals.length && terminals.length > 0} /></TableHead>
                                <TableHead>{t('nicknameColumn')}</TableHead><TableHead>{t('serialNumberColumn')}</TableHead><TableHead>{t('statusColumn')}</TableHead><TableHead className="text-right">{t('actionsColumn')}</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {terminals.map(terminal => (
                                    <TableRow key={terminal.id}>
                                        <TableCell><Checkbox onCheckedChange={(checked) => handleSelectRow(terminal.id, Boolean(checked))} checked={selectedTerminalIds.has(terminal.id)} /></TableCell>
                                        <TableCell>{terminal.nickname}</TableCell>
                                        <TableCell className="font-mono">{terminal.dishSerialNumber}</TableCell>
                                        <TableCell><Badge className={terminal.status === 'ACTIVE' ? 'bg-green-600' : 'bg-zinc-500'}>{terminal.status}</Badge></TableCell>
                                        <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => router.push(`/starlink/terminal/${terminal.id}`)}><Wrench className="mr-2 h-4 w-4"/> {t('manageButton')}</Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                 </TabsContent>
                 <TabsContent value="alerts" className="mt-4">
                     <Card>
                        <CardHeader><CardTitle>{t('accountAlertsTitle')}</CardTitle><CardDescription>{t('accountAlertsDescription')}</CardDescription></CardHeader>
                        <CardContent className="space-y-4">
                            {alerts.map(alert => (
                                <Alert key={alert.id} variant={alert.severity === 'CRITICAL' ? 'destructive' : 'default'}>
                                    <AlertCircle className="h-4 w-4" />
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <AlertTitle>{alert.category} - <span className="font-normal">{alert.message}</span></AlertTitle>
                                            <AlertDescription className="text-xs mt-1">Terminal: {alert.userTerminalId} • Statut: {alert.status}</AlertDescription>
                                        </div>
                                        {alert.status === 'ACTIVE' && (
                                            <Button size="sm" variant="outline" onClick={() => {}} disabled={isActionLoading}>{t('acknowledgeButton')}</Button>
                                        )}
                                    </div>
                                </Alert>
                            ))}
                        </CardContent>
                     </Card>
                 </TabsContent>
                 <TabsContent value="billing" className="mt-4">
                    <Card>
                        <CardHeader><CardTitle>{t('billingCyclesTitle')}</CardTitle><CardDescription>{t('billingCyclesDescription')}</CardDescription></CardHeader>
                         <CardContent>
                           <Table>
                            <TableHeader><TableRow><TableHead>{t('invoiceIdColumn')}</TableHead><TableHead>{t('dueDateColumn')}</TableHead><TableHead>{t('amountColumn')}</TableHead><TableHead className="text-right">{t('statusColumn')}</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {billingCycles.map(cycle => (
                                <TableRow key={cycle.billing_cycle_id}>
                                    <TableCell className="font-mono">{cycle.invoice_id}</TableCell>
                                    <TableCell>{format(new Date(cycle.due_date), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>${cycle.amount_due.toFixed(2)} {cycle.currency}</TableCell>
                                    <TableCell className="text-right"><Badge variant={cycle.status === 'PAID' ? 'default' : 'destructive'} className={cn(cycle.status === 'PAID' && 'bg-green-600')}>{cycle.status}</Badge></TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                           </Table>
                         </CardContent>
                    </Card>
                 </TabsContent>
                 <TabsContent value="settings" className="mt-4">
                    <Card>
                        <CardHeader><CardTitle>{t('resellerSettingsTitle')}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
                                <div><p className="font-semibold text-sm">{t('localCacheTitle')}</p><p className="text-xs text-muted-foreground">{t('localCacheDescription')}</p></div>
                                <Switch onCheckedChange={() => {}} disabled={isActionLoading} />
                            </div>
                            <div className="p-3 border rounded-lg bg-background">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Label className="font-semibold text-sm">{t('apiKeysTitle')}</Label>
                                        <p className="text-xs text-muted-foreground mb-2">{t('apiKeysDescription')}</p>
                                    </div>
                                     <Dialog open={isApiUpdateOpen} onOpenChange={setIsApiUpdateOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">{t('updateButton')}</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>{t('apiKeysUpdateTitle')}</DialogTitle>
                                                <DialogDescription>{t('apiKeysUpdateDescription')}</DialogDescription>
                                            </DialogHeader>
                                             <Form {...apiForm}><form onSubmit={apiForm.handleSubmit(handleApiSubmit)} className="space-y-4 pt-4">
                                                <FormField control={apiForm.control} name="apiKey" render={({ field }) => ( <FormItem><FormLabel>{t('newApiKeyLabel')}</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                                <FormField control={apiForm.control} name="apiSecret" render={({ field }) => ( <FormItem><FormLabel>{t('newApiSecretLabel')}</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                                <DialogFooter>
                                                    <Button type="submit" variant="gradient" disabled={isActionLoading}>
                                                        {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} {t('updateAndSyncButton')}
                                                    </Button>
                                                </DialogFooter>
                                            </form></Form>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                                <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">{t('resellerAccountLabel')}: {resellerConfig.accountId}</div>
                            </div>
                        </CardContent>
                    </Card>
                 </TabsContent>
            </Tabs>
        </div>
    );
};


export function StarlinkDashboardClient() {
    const { t } = useTranslation();
    const [user, setUser] = useState<UserType | null>(null);
    useEffect(() => {
        getAuthenticatedUser().then(setUser);
    }, []);
    
    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-3"><Satellite className="h-8 w-8 text-primary"/>{t('starlinkDashboardTitle')}</h1>
                <p className="text-muted-foreground mt-2">{t('starlinkDashboardDescription')}</p>
            </div>
            <Tabs defaultValue="client" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
                    <TabsTrigger value="client"><User className="mr-2 h-4 w-4"/> {t('clientModeTab')}</TabsTrigger>
                    <TabsTrigger value="reseller"><Briefcase className="mr-2 h-4 w-4"/> {t('resellerModeTab')}</TabsTrigger>
                </TabsList>
                <TabsContent value="client" className="mt-6"><ClientView user={user} /></TabsContent>
                <TabsContent value="reseller" className="mt-6"><ResellerView user={user} /></TabsContent>
            </Tabs>
        </main>
    );
}
