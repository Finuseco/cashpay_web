
'use client';

import { useState, useEffect } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
    getCountryInternationalClaims,
    approveInternationalClaim
} from '@/lib/actions/super-agent/finance.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';

export default function InternationalClaimsPage() {
    const [claims, setClaims] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
    const [isPinOpen, setIsPinOpen] = useState(false);
    const [pin, setPin] = useState('');
    const [isApproving, setIsApproving] = useState(false);
    const [superAgent, setSuperAgent] = useState<any>(null);
    const [filter, setFilter] = useState('');

    const { openAlert } = useAlertDialog();

    const fetchData = async () => {
        setIsLoading(true);
        const current = await getAuthenticatedUser();
        setSuperAgent(current);
        if (current?.country) {
            const data = await getCountryInternationalClaims(current.country);
            setClaims(data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData().catch(() => { setIsLoading(false); openAlert({ title: 'Chargement impossible', description: 'Données indisponibles. Actualisez la page pour réessayer.', variant: 'error' }); });
    }, []);

    const handleOpenApprove = (claim: any) => {
        setSelectedClaim(claim);
        setPin('');
        setIsPinOpen(true);
    };

    const handleConfirmApproval = async () => {
        if (!selectedClaim || !superAgent) return;

        setIsApproving(true);
        const result = await approveInternationalClaim(selectedClaim.id, superAgent.id, pin);
        setIsApproving(false);

        if (result.success) {
            openAlert({
                title: 'Transfert Approuvé',
                description: `La réclamation de ${selectedClaim.full_name} a été approuvée administrativement. Aucun crédit automatique n’a été effectué ; le règlement financier reste à rapprocher.`,
                variant: 'success'
            });
            setIsPinOpen(false);
            fetchData();
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    const filteredClaims = claims.filter(c =>
        c.tracking_number.toLowerCase().includes(filter.toLowerCase()) ||
        c.full_name.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Réclamations Internationales</h1>
                    <p className="text-sm text-zinc-400">Validez les transferts Western Union, MoneyGram et Ria reçus en agence.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Référence ou Nom..."
                        className="pl-9 bg-zinc-800 border-zinc-700"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <Dialog open={isPinOpen} onOpenChange={setIsPinOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Confirmer le Crédit Client</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            En approuvant cette réclamation, vous confirmez que l'agence a bien reçu les fonds sur son compte <strong>{selectedClaim?.provider?.toUpperCase()}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between"><span>Bénéficiaire:</span><span className="font-bold">{selectedClaim?.full_name}</span></div>
                        <div className="flex justify-between"><span>Tracking (MTCN):</span><span className="font-mono">{selectedClaim?.tracking_number}</span></div>
                        <div className="flex justify-between border-t pt-2 mt-2 font-bold text-lg">
                            <span>Crédit CashPay:</span>
                            <span className="text-green-500">{selectedClaim?.expected_amount} {selectedClaim?.receive_in_currency}</span>
                        </div>
                    </div>
                    <div className="flex justify-center py-4">
                        <InputOTP maxLength={4} value={pin} onChange={setPin}>
                            <InputOTPGroup>
                                <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                            </InputOTPGroup>
                        </InputOTP>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsPinOpen(false)}>Annuler</Button>
                        <Button onClick={handleConfirmApproval} disabled={isApproving || pin.length < 4} variant="gradient">
                            {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Approuver & Créditer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardHeader>
                    <CardTitle>Demandes en attente de vérification</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700">
                                <TableHead className="text-zinc-400">Date</TableHead>
                                <TableHead className="text-zinc-400">Service</TableHead>
                                <TableHead className="text-zinc-400">Tracking (MTCN)</TableHead>
                                <TableHead className="text-zinc-400">Client</TableHead>
                                <TableHead className="text-zinc-400">Montant Attendu</TableHead>
                                <TableHead className="text-zinc-400 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                            ) : filteredClaims.length > 0 ? filteredClaims.map(claim => (
                                <TableRow key={claim.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                    <TableCell className="text-xs">{format(new Date(claim.created_at), 'dd/MM/yy HH:mm')}</TableCell>
                                    <TableCell><Badge variant="outline" className="uppercase border-zinc-600 text-zinc-300">{claim.provider}</Badge></TableCell>
                                    <TableCell className="font-mono text-sm">{claim.tracking_number}</TableCell>
                                    <TableCell>
                                        <p className="font-bold text-sm">{claim.full_name}</p>
                                        <p className="text-[10px] text-zinc-400">{claim.id_wallet}</p>
                                    </TableCell>
                                    <TableCell className="font-bold">
                                        {parseFloat(claim.expected_amount).toFixed(2)} {claim.expected_currency}
                                        <p className="text-[10px] text-green-500">Verser en {claim.receive_in_currency}</p>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {claim.status === 'pending' ? (
                                            <Button size="sm" onClick={() => handleOpenApprove(claim)}>
                                                <ShieldCheck className="h-4 w-4 mr-1"/> Vérifié & Créditer
                                            </Button>
                                        ) : (
                                            <Badge className="bg-green-500">Traité le {format(new Date(claim.processed_at), 'dd/MM')}</Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={6} className="text-center py-10 text-zinc-500">Aucune réclamation de transfert international.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
