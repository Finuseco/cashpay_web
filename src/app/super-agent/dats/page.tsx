
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, PiggyBank, CheckCircle, XCircle, Search } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCountryDats, processDatDecision } from '@/lib/actions/super-agent/finance.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

export default function SuperAgentDats() {
    const [dats, setDats] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDat, setSelectedDat] = useState<any | null>(null);
    const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
    const [pin, setPin] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [superAgent, setSuperAgent] = useState<any>(null);
    const [filter, setFilter] = useState('');
    
    const { openAlert } = useAlertDialog();

    const fetchData = async () => {
        setIsLoading(true);
        const current = await getAuthenticatedUser();
        setSuperAgent(current);
        if (current?.country) {
            const data = await getCountryDats(current.country);
            setDats(data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenAction = (dat: any, type: 'approve' | 'reject') => {
        setSelectedDat(dat);
        setActionType(type);
        setPin('');
    };

    const handleConfirmAction = async () => {
        if (!selectedDat || !superAgent || !actionType) return;

        setIsProcessing(true);
        const result = await processDatDecision(selectedDat.id, actionType, superAgent.id, pin);
        setIsProcessing(false);

        if (result.success) {
            openAlert({
                title: actionType === 'approve' ? 'DAT Approuvé' : 'DAT Rejeté',
                description: actionType === 'approve' 
                    ? `Le placement de ${selectedDat.amount} ${selectedDat.currency} a été validé.`
                    : `Le DAT a été rejeté et le client a été remboursé.`,
                variant: 'success'
            });
            setSelectedDat(null);
            setActionType(null);
            fetchData();
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    const filtered = dats.filter(d => 
        d.full_name.toLowerCase().includes(filter.toLowerCase()) ||
        d.id.toString().includes(filter)
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><PiggyBank className="text-primary"/> Dépôts à Terme (DAT)</h1>
                    <p className="text-sm text-zinc-400">Validez les investissements bloqués des clients de votre pays.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input 
                        placeholder="Rechercher..." 
                        className="pl-9 bg-zinc-800 border-zinc-700"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <Dialog open={!!selectedDat} onOpenChange={(open) => !open && setSelectedDat(null)}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>{actionType === 'approve' ? 'Valider le DAT' : 'Rejeter le DAT'}</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {actionType === 'approve' 
                                ? "En validant, les fonds seront bloqués pour la durée choisie."
                                : "En cas de rejet, le capital sera immédiatement remboursé au client."}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between"><span>Client:</span><span className="font-bold">{selectedDat?.full_name}</span></div>
                        <div className="flex justify-between"><span>Montant:</span><span className="font-bold text-primary">{selectedDat?.amount} {selectedDat?.currency}</span></div>
                        <div className="flex justify-between"><span>Durée:</span><span>{selectedDat?.duration_months} mois</span></div>
                        <div className="flex justify-between"><span>Rendement prévu:</span><span className="text-green-500 font-bold">+{selectedDat?.total_return} {selectedDat?.currency}</span></div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-center block">PIN de sécurité requis</Label>
                        <div className="flex justify-center py-2">
                            <InputOTP maxLength={4} value={pin} onChange={setPin}>
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSelectedDat(null)}>Annuler</Button>
                        <Button 
                            onClick={handleConfirmAction} 
                            disabled={isProcessing || pin.length < 4} 
                            variant={actionType === 'approve' ? 'default' : 'destructive'}
                        >
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Confirmer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700">
                                <TableHead className="text-zinc-400">Date</TableHead>
                                <TableHead className="text-zinc-400">Client</TableHead>
                                <TableHead className="text-zinc-400">Montant</TableHead>
                                <TableHead className="text-zinc-400">Durée</TableHead>
                                <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                            ) : filtered.length > 0 ? filtered.map(dat => (
                                <TableRow key={dat.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                    <TableCell className="text-xs text-zinc-500">{format(new Date(dat.created_at), 'dd/MM HH:mm')}</TableCell>
                                    <TableCell>
                                        <p className="font-bold text-sm">{dat.full_name}</p>
                                        <p className="text-[10px] text-zinc-400">{dat.phone}</p>
                                    </TableCell>
                                    <TableCell className="font-bold text-primary">{parseFloat(dat.amount).toFixed(2)} {dat.currency}</TableCell>
                                    <TableCell>{dat.duration_months} mois</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="outline" className="border-green-600 text-green-500 hover:bg-green-600" onClick={() => handleOpenAction(dat, 'approve')}>
                                                <CheckCircle className="h-4 w-4 mr-1"/> Valider
                                            </Button>
                                            <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-400/10" onClick={() => handleOpenAction(dat, 'reject')}>
                                                <XCircle className="h-4 w-4 mr-1"/> Rejeter
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={5} className="text-center py-10 text-zinc-500">Aucune demande de DAT en attente.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
