

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, ArrowLeft, Satellite, Signal, Info, RotateCw, Wrench, Edit, ShieldCheck, Database, Save, Server, Route, AlertTriangle, PlayCircle, BarChartHorizontal } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getTerminalsForAccount, rebootUserTerminal, setServiceLineNickname, setServiceLineProduct, setPublicIp, topUpData, setRecurringData, cancelUserTerminal, optInToService, runDiagnostics, getDiagnosticResults, getResellerConfig } from '@/lib/actions/starlink.actions';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from "react-i18next";
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

interface Terminal {
  id: string;
  serviceLineNumber: string;
  nickname: string;
  dishSerialNumber: string;
  status: string;
  product: { id: string, name: string };
  publicIpOptIn: boolean;
  dataBalanceGb: number;
}

export function TerminalDetailClient({ terminalId }: { terminalId: string }) {
    const { t } = useTranslation();
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    
    const [terminal, setTerminal] = useState<Terminal | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [resellerConfig, setResellerConfig] = useState<any>(null);

    const [nickname, setNickname] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [publicIpEnabled, setPublicIpEnabled] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState(50);
    const [recurringAmount, setRecurringAmount] = useState(0);
    const [diagnosticId, setDiagnosticId] = useState<string | null>(null);
    const [diagnosticResults, setDiagnosticResults] = useState<any | null>(null);

    useEffect(() => {
        const fetchTerminal = async () => {
            setIsLoading(true);
            const user = await getAuthenticatedUser();
            if (!user) {
                router.push('/login');
                return;
            }
            const config = await getResellerConfig(user.id);
            setResellerConfig(config);

            const result = await getTerminalsForAccount(config || { accountId: 'acc_reseller_mock' }); // Fallback for client mode simulation
            if (result.success && result.data) {
                const foundTerminal = result.data.find((t: any) => t.id === terminalId);
                setTerminal(foundTerminal || null);
                if (foundTerminal) {
                    setNickname(foundTerminal.nickname);
                    setSelectedProduct(foundTerminal.product.id);
                    setPublicIpEnabled(foundTerminal.publicIpOptIn);
                }
            }
            setIsLoading(false);
        };
        fetchTerminal();
    }, [terminalId, router]);

    const handleAction = async (action: () => Promise<any>, actionName: string) => {
        setActionLoading(actionName);
        try {
            const result = await action();
            if (result.success) {
                openAlert({ title: 'Succès', description: `L'action "${actionName}" a été effectuée.`, variant: 'success' });
            } else {
                openAlert({ title: t('errorTitle'), description: result.error || "Une erreur est survenue.", variant: 'error' });
            }
        } catch (e: any) {
            openAlert({ title: 'Erreur Critique', description: e.message, variant: 'error' });
        } finally {
            setActionLoading(null);
        }
    };
    
    const handleCancelService = () => {
        openAlert({
            title: 'Annuler ce service ?',
            description: 'Cette action est irréversible. Le service pour ce terminal sera définitivement annulé.',
            variant: 'warning',
            onClose: async () => {
                await handleAction(() => cancelUserTerminal(resellerConfig.accountId, terminal!.id), 'Annuler le service');
                router.push('/starlink/dashboard');
            }
        })
    };
    
    const handleRunDiagnostics = async () => {
        if (!resellerConfig || !terminal) return;
        setDiagnosticResults(null);
        setActionLoading('Lancer les diagnostics');
        const result = await runDiagnostics(resellerConfig.accountId, terminal.id);
        if(result.success && result.data?.diagnosticId) {
            setDiagnosticId(result.data.diagnosticId);
            const checkResults = async () => {
                const results = await getDiagnosticResults(resellerConfig.accountId, terminal.id, result.data.diagnosticId);
                if (results.success && results.data.status === 'complete') {
                    setDiagnosticResults(results.data.results);
                    setActionLoading(null);
                } else {
                    setTimeout(checkResults, 2000);
                }
            }
            setTimeout(checkResults, 1000); // Start checking after 1s
        } else {
            openAlert({ title: t('errorTitle'), description: 'Impossible de lancer les diagnostics.', variant: 'error' });
            setActionLoading(null);
        }
    }

    if (isLoading) {
        return <DashboardLayout><div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div></DashboardLayout>;
    }

    if (!terminal || !resellerConfig) {
        return <DashboardLayout><div>Terminal non trouvé ou configuration manquante.</div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Satellite/> {terminal.nickname}</h1>
                            <p className="text-muted-foreground font-mono text-xs">{terminal.id} / {terminal.serviceLineNumber}</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('statusColumn')}</CardTitle></CardHeader><CardContent><Badge className={terminal.status === 'ACTIVE' ? 'bg-green-600' : 'bg-zinc-500'}>{terminal.status}</Badge></CardContent></Card>
                        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t('serialNumberColumn')}</CardTitle></CardHeader><CardContent><p className="font-mono">{terminal.dishSerialNumber}</p></CardContent></Card>
                        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Balance de Données</CardTitle></CardHeader><CardContent><p className="font-bold text-xl">{terminal.dataBalanceGb} GB</p></CardContent></Card>
                    </div>

                    <Card>
                        <CardHeader><CardTitle>Informations Générales</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-end gap-2">
                                <div className="flex-grow w-full">
                                    <Label htmlFor="nickname">{t('terminalNicknameLabel')}</Label>
                                    <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
                                </div>
                                <Button onClick={() => handleAction(() => setServiceLineNickname(resellerConfig.accountId, terminal.serviceLineNumber, nickname), 'Modifier le surnom')} disabled={actionLoading === 'Modifier le surnom'}>
                                    {actionLoading === 'Modifier le surnom' ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>} {t('saveButton')}
                                </Button>
                            </div>
                            <Button variant="outline" onClick={() => handleAction(() => rebootUserTerminal(resellerConfig.accountId, terminal.id), 'Redémarrer le terminal')} disabled={!!actionLoading}>
                                {actionLoading === 'Redémarrer le terminal' ? <Loader2 className="animate-spin mr-2"/> : <RotateCw className="mr-2"/>} {t('rebootTerminalButton')}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Plan de Service</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-end gap-2">
                                <div className="flex-grow w-full">
                                    <Label htmlFor="servicePlan">{t('activeProductLabel')}</Label>
                                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                                        <SelectTrigger id="servicePlan"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="prd_mobile_regional">Mobile Regional</SelectItem>
                                            <SelectItem value="prd_mobile_priority">Mobile Priority 50GB</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={() => handleAction(() => setServiceLineProduct(resellerConfig.accountId, terminal.serviceLineNumber, selectedProduct), 'Changer de Plan')} disabled={actionLoading === 'Changer de Plan' || selectedProduct === terminal.product.id}>
                                    {actionLoading === 'Changer de Plan' ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>} {t('changePlanButton')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    
                     <Card>
                        <CardHeader><CardTitle>{t('dataManagementTitle')}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-end gap-2">
                                <div className="flex-grow w-full">
                                    <Label htmlFor="topup">{t('oneTimeTopUpLabel')}</Label>
                                    <Input id="topup" type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(Number(e.target.value))} />
                                </div>
                                <Button onClick={() => handleAction(() => topUpData(resellerConfig.accountId, terminal.serviceLineNumber, topUpAmount), 'Acheter Top-Up')} disabled={actionLoading === 'Acheter Top-Up'}>
                                    {actionLoading === 'Acheter Top-Up' && <Loader2 className="animate-spin mr-2"/>} {t('buyButton')}
                                </Button>
                            </div>
                             <div className="flex items-end gap-2">
                                <div className="flex-grow w-full">
                                    <Label htmlFor="recurring">{t('recurringTopUpLabel')}</Label>
                                     <Select value={recurringAmount.toString()} onValueChange={(val) => setRecurringAmount(Number(val))}>
                                        <SelectTrigger id="recurring"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">{t('disabledOption')}</SelectItem>
                                            <SelectItem value="50">50 GB</SelectItem>
                                            <SelectItem value="100">100 GB</SelectItem>
                                            <SelectItem value="200">200 GB</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={() => handleAction(() => setRecurringData(resellerConfig.accountId, terminal.serviceLineNumber, recurringAmount), 'Définir Récurrence')} disabled={actionLoading === 'Définir Récurrence'}>
                                    {actionLoading === 'Définir Récurrence' ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>} {t('setButton')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>{t('advancedOptionsTitle')}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                             <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
                                <div><p className="font-semibold text-sm">{t('publicIpLabel')}</p><p className="text-xs text-muted-foreground">{t('publicIpDescription')}</p></div>
                                <Switch checked={publicIpEnabled} onCheckedChange={(checked) => { setPublicIpEnabled(checked); handleAction(() => setPublicIp(resellerConfig.accountId, terminal.serviceLineNumber, checked), 'Mettre à jour IP') }} disabled={!!actionLoading} />
                            </div>
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
                                <div><p className="font-semibold text-sm">{t('optInServiceLabel')}</p><p className="text-xs text-muted-foreground">{t('optInServiceDescription')}</p></div>
                                <Button variant="secondary" onClick={() => handleAction(() => optInToService(resellerConfig.accountId, terminal.serviceLineNumber), 'Activer l\'Opt-In')} disabled={!!actionLoading}>{t('optInActivateButton')}</Button>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><BarChartHorizontal/> {t('diagnosticsTitle')}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <Button className="w-full" variant="outline" onClick={handleRunDiagnostics} disabled={!!actionLoading}>
                                {actionLoading === 'Lancer les diagnostics' ? <Loader2 className="animate-spin mr-2"/> : <PlayCircle className="mr-2"/>}
                                {t('runDiagnosticsButton')}
                            </Button>
                            {diagnosticResults && (
                                <div className="p-3 border rounded-lg bg-background text-sm space-y-2">
                                    <p><strong>{t('diagnosticsResultsLabel', {id: diagnosticId})}</strong></p>
                                    <p>{t('packetLossLabel')} : <span className="font-mono">{(diagnosticResults.ping_stats.drop_rate * 100).toFixed(2)}%</span></p>
                                    <p>{t('pingLatencyLabel')} : <span className="font-mono">{diagnosticResults.ping_stats.latency_ms.toFixed(2)} ms</span></p>
                                    <p>{t('obstructionFractionLabel')} : <span className="font-mono">{(diagnosticResults.obstruction.fraction * 100).toFixed(2)}%</span></p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-destructive">
                        <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle/> {t('dangerZoneTitle')}</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
                                <div>
                                    <p className="font-semibold text-sm">{t('cancelServiceLabel')}</p>
                                    <p className="text-xs text-muted-foreground">{t('cancelServiceDescription')}</p>
                                </div>
                                <Button variant="destructive" onClick={handleCancelService}>{t('cancelButton')}</Button>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </main>
        </DashboardLayout>
    );
}
