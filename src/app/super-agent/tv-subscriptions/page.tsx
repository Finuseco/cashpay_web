
'use client';

import { useState, useEffect } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
    getCountryTvRequests,
    processTvSubscription
} from '@/lib/actions/super-agent/staff.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SuperAgentTvSubscriptions() {
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [actionType, setActionType] = useState<'activate' | 'reject' | null>(null);
    const [providerReference, setProviderReference] = useState('');
    const [loadError, setLoadError] = useState('');
    const [pin, setPin] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [superAgent, setSuperAgent] = useState<any>(null);
    const [filter, setFilter] = useState('');

    const { openAlert } = useAlertDialog();

    const fetchData = async () => {
        setIsLoading(true);
        setLoadError('');
        try {
        const current = await getAuthenticatedUser();
        if (!current) throw new Error('Session expirée.');
        setSuperAgent(current);
        if (current?.country) {
            const data = await getCountryTvRequests(current.country);
            setRequests(data);
        }
        } catch { setLoadError('Impossible de charger les demandes. Réessayez.'); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        fetchData().catch(() => { setIsLoading(false); openAlert({ title: 'Chargement impossible', description: 'Données indisponibles. Actualisez la page pour réessayer.', variant: 'error' }); });
    }, []);

    const handleOpenAction = (request: any, type: 'activate' | 'reject') => {
        setSelectedRequest(request);
        setActionType(type);
        setPin(''); setProviderReference('');
    };

    const handleConfirmAction = async () => {
        if (!selectedRequest || !superAgent || !actionType) return;

        setIsProcessing(true);
        try {
        const result = await processTvSubscription({
            requestId: selectedRequest.id,
            adminId: superAgent.id,
            action: actionType,
            providerReference,
            pin: pin
        });
        setIsProcessing(false);

        if (result.success) {
            openAlert({
                title: actionType === 'activate' ? 'Abonnement Activé' : 'Demande Rejetée',
                description: actionType === 'activate'
                    ? `L'abonnement ${selectedRequest.operator_name} pour ${selectedRequest.full_name} est désormais actif.`
                    : `La demande a été annulée et le client a été remboursé de ${result.refundedAmount} ${result.currency}.`,
                variant: 'success'
            });
            setSelectedRequest(null);
            setActionType(null);
            fetchData();
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
        } catch { openAlert({ title: 'Erreur', description: 'Aucune confirmation reçue.', variant: 'error' }); }
        finally { setIsProcessing(false); }
    };

    const filteredRequests = requests.filter(r =>
        String(r.smartcard_number || '').toLowerCase().includes(filter.toLowerCase()) ||
        String(r.full_name || '').toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {loadError && <p role="alert">{loadError} <Button onClick={fetchData}>Réessayer</Button></p>}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Gestion Abonnements TV</h1>
                    <p className="text-sm text-zinc-400">Activez manuellement les abonnements payés ou rejetez les demandes invalides.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="N° Décodeur ou Nom..."
                        className="pl-9 bg-zinc-800 border-zinc-700"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>{actionType === 'activate' ? 'Confirmer l\'Activation' : 'Confirmer le Rejet'}</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {actionType === 'activate'
                                ? "Confirmez que vous avez bien activé l'abonnement sur le portail du fournisseur."
                                : "Le client sera automatiquement remboursé du montant total payé."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between"><span>Fournisseur:</span><span className="font-bold uppercase text-primary">{selectedRequest?.operator_name}</span></div>
                        <div className="flex justify-between"><span>Bouquet:</span><span className="font-semibold">{selectedRequest?.service_name}</span></div>
                        <div className="flex justify-between"><span>N° Décodeur:</span><span className="font-mono text-yellow-500">{selectedRequest?.smartcard_number}</span></div>
                        <div className="flex justify-between"><span>Client:</span><span>{selectedRequest?.full_name}</span></div>
                        <div className="flex justify-between border-t pt-2 mt-2 font-bold">
                            <span>Montant Payé:</span>
                            <span>{selectedRequest?.amount} {selectedRequest?.currency || '—'}</span>
                        </div>
                    </div>

                    {actionType === 'activate' && <div className="space-y-2"><Label>Référence de confirmation du fournisseur</Label><Input value={providerReference} onChange={event => setProviderReference(event.target.value)} /></div>}
                    <div className="space-y-2">
                        <Label className="text-center block">Entrez votre PIN Super Agent</Label>
                        <div className="flex justify-center py-2">
                            <InputOTP maxLength={4} value={pin} onChange={setPin}>
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSelectedRequest(null)}>Annuler</Button>
                        <Button
                            onClick={handleConfirmAction}
                            disabled={isProcessing || pin.length < 4 || (actionType === 'activate' && providerReference.trim().length < 4)}
                            variant={actionType === 'activate' ? 'default' : 'destructive'}
                        >
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {actionType === 'activate' ? 'Activer maintenant' : 'Confirmer le Rejet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardHeader>
                    <CardTitle>Demandes en attente</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700">
                                <TableHead className="text-zinc-400">Date</TableHead>
                                <TableHead className="text-zinc-400">Service</TableHead>
                                <TableHead className="text-zinc-400">N° Smartcard</TableHead>
                                <TableHead className="text-zinc-400">Bouquet</TableHead>
                                <TableHead className="text-zinc-400">Montant</TableHead>
                                <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                            ) : filteredRequests.length > 0 ? filteredRequests.map(req => (
                                <TableRow key={req.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                    <TableCell className="text-xs">{format(new Date(req.created_at), 'dd/MM HH:mm')}</TableCell>
                                    <TableCell><Badge variant="outline" className="uppercase border-zinc-600 text-zinc-300">{req.operator_name}</Badge></TableCell>
                                    <TableCell className="font-mono text-sm">{req.smartcard_number}</TableCell>
                                    <TableCell>
                                        <p className="font-bold text-sm">{req.service_name}</p>
                                        <p className="text-[10px] text-zinc-400">{req.full_name}</p>
                                    </TableCell>
                                    <TableCell className="font-bold text-primary">{parseFloat(req.amount).toFixed(2)} {req.currency || '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="outline" className="border-green-600 text-green-500 hover:bg-green-600 hover:text-white" onClick={() => handleOpenAction(req, 'activate')}>
                                                <CheckCircle className="h-4 w-4 mr-1"/> Activer
                                            </Button>
                                            <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-400/10" onClick={() => handleOpenAction(req, 'reject')}>
                                                <XCircle className="h-4 w-4 mr-1"/> Rejeter
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={6} className="text-center py-10 text-zinc-500">Aucune demande d'abonnement TV en attente.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
