
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Handshake, CheckCircle, XCircle, Search, Banknote, Calendar, History, AlertTriangle } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
    getCountryLoans,
    processLoanDecision,
    triggerManualLoanCollection,
    triggerCountryLoanCollection
} from '@/lib/actions/super-agent/finance.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, isBefore, addMonths, isToday, isPast } from "date-fns";
import { cn } from '@/lib/utils';
import { fr } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function SuperAgentLoans() {
    const [loans, setLoans] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
    const [actionType, setActionType] = useState<'approve' | 'reject' | 'collect' | 'view_schedule' | null>(null);
    const [pin, setPin] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCountryCollecting, setIsCountryCollecting] = useState(false);
    const [isCountryPinDialogOpen, setIsCountryPinDialogOpen] = useState(false);
    const [superAgent, setSuperAgent] = useState<any>(null);
    const [filter, setFilter] = useState('');
    
    const { openAlert } = useAlertDialog();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const current = await getAuthenticatedUser();
            setSuperAgent(current);
            if (current?.country) {
                const data = await getCountryLoans(current.country);
                setLoans(Array.isArray(data) ? data : []);
            } else setLoans([]);
        } catch {
            setLoans([]);
            openAlert({ title: 'Erreur', description: 'Impossible de charger les demandes LoanMe.', variant: 'error' });
        } finally { setIsLoading(false); }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCountryLoanCollection = async () => {
        if (!superAgent || String(superAgent.role || '').trim() !== 'SuperAgent') {
            return;
        }

        if (!/^\d{4}$/.test(pin)) {
            openAlert({
                title: 'PIN requis',
                description: 'Veuillez saisir votre PIN Super Agent à 4 chiffres.',
                variant: 'error'
            });
            return;
        }

        setIsCountryCollecting(true);

        try {
            const result = await triggerCountryLoanCollection(
                Number(superAgent.id),
                pin
            );

            if (!result?.success) {
                openAlert({
                    title: 'Recouvrement non effectué',
                    description: result?.error || 'Le recouvrement n’a pas pu être exécuté.',
                    variant: 'error'
                });
                return;
            }

            const processed = Number(result.processed || 0);
            const failed = Number(result.failed || 0);

            openAlert({
                title: failed > 0
                    ? 'Recouvrement partiellement effectué'
                    : 'Recouvrement effectué',
                description:
                    `Échéances traitées : ${processed}. ` +
                    `Clients concernés : ${Number(result.users || 0)}. ` +
                    `Échecs : ${failed}.`,
                variant: failed > 0 ? 'error' : 'success'
            });

            setPin('');
            setIsCountryPinDialogOpen(false);
            await fetchData();

        } catch (error: any) {
            openAlert({
                title: 'Erreur',
                description: error?.message || 'Impossible de lancer le recouvrement.',
                variant: 'error'
            });
        } finally {
            setIsCountryCollecting(false);
        }
    };

    const handleOpenAction = (loan: any, type: 'approve' | 'reject' | 'collect' | 'view_schedule') => {
        setSelectedLoan(loan);
        setActionType(type);
        setPin('');
    };

    const handleConfirmAction = async () => {
        if (!selectedLoan || !superAgent || !actionType) return;

        setIsProcessing(true);
        let result: any;
        try {
            if (actionType === 'collect') {
                result = await triggerManualLoanCollection(Number(selectedLoan.id), Number(superAgent.id), pin);
            } else if (actionType === 'approve' || actionType === 'reject') {
                result = await processLoanDecision(Number(selectedLoan.id), actionType, Number(superAgent.id), pin);
            } else {
                return;
            }
        } catch (error: any) {
            result = { success: false, error: error?.message || 'Impossible de traiter cette action.' };
        } finally {
            setIsProcessing(false);
        }

        if (result?.success) {
            openAlert({
                title: actionType === 'collect' ? 'Action de Recouvrement Terminée' : (actionType === 'approve' ? 'Prêt Approuvé' : 'Demande Rejetée'),
                description: actionType === 'collect' 
                    ? "L'opération a été traitée. Si le solde était insuffisant, une pénalité a été appliquée."
                    : (actionType === 'approve' ? `Les fonds ont été crédités au client.` : `La demande a été rejetée.`),
                variant: 'success'
            });
            setSelectedLoan(null);
            setActionType(null);
            fetchData();
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    const normalizedFilter = filter.trim().toLowerCase();
    const filtered = loans.filter(l => {
        if (!normalizedFilter) return true;
        return String(l.full_name ?? '').toLowerCase().includes(normalizedFilter) ||
            String(l.id_wallet ?? '').toLowerCase().includes(normalizedFilter) ||
            String(l.phone ?? '').toLowerCase().includes(normalizedFilter) ||
            String(l.id ?? '').toLowerCase().includes(normalizedFilter) ||
            String(l.status ?? '').toLowerCase().includes(normalizedFilter);
    });

    const getSchedule = (loan: any) => {
        // Si le backend fournit déjà l'échéancier, il reste la source d'affichage prioritaire.
        if (Array.isArray(loan.schedule) && loan.schedule.length) {
            return loan.schedule.map((item: any) => {
                const dueDate = new Date(item.due_date ?? item.dueDate);
                const remaining = Number(item.remaining_amount ?? Math.max(0, Number(item.amount ?? 0) + Number(item.penalty ?? item.penalty_amount ?? 0) - Number(item.paid_amount ?? 0)));
                return {
                    dueDate,
                    amount: Number(item.amount ?? 0),
                    remaining,
                    isPaid: String(item.status ?? '').toLowerCase() === 'paid' || remaining <= 0.005,
                    status: String(item.status ?? '').toLowerCase(),
                    installmentNumber: item.installment_number,
                    penalty: Number(item.penalty ?? item.penalty_amount ?? 0),
                };
            }).filter((x: any) => Number.isFinite(x.dueDate.getTime()));
        }

        if (!loan.approval_date) return [];
        const schedule: any[] = [];
        const installmentAmount = Number(loan.installment_amount ?? loan.monthly_payment ?? 0);
        const count = Number(loan.installment_count ?? loan.duration ?? 0);
        const frequency = String(loan.repayment_frequency ?? 'monthly').toLowerCase();
        const repayments = Array.isArray(loan.repayments) ? loan.repayments : [];
        const approvalDate = new Date(loan.approval_date);
        if (!Number.isFinite(approvalDate.getTime()) || !Number.isFinite(count) || count <= 0) return [];

        for (let i = 1; i <= count; i++) {
            const dueDate = new Date(approvalDate);
            if (frequency === 'weekly') dueDate.setDate(dueDate.getDate() + (i * 7));
            else dueDate.setMonth(dueDate.getMonth() + i);

            const paid = repayments
                .filter((r: any) => String(r.type ?? '').toLowerCase() === 'repayment')
                .reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0);
            const paidForThisInstallment = Math.min(installmentAmount, paid);
            const isPaid = paidForThisInstallment >= installmentAmount && installmentAmount > 0;
            schedule.push({ dueDate, amount: installmentAmount, remaining: Math.max(0, installmentAmount - paidForThisInstallment), isPaid });
        }
        return schedule;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Handshake className="text-primary"/> Recouvrement Souverain</h1>
                    <p className="text-sm text-zinc-400">Suivi des échéances nationales et prélèvement forcé avec pénalités.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input 
                        placeholder="Rechercher un client..." 
                        className="pl-9 bg-zinc-800 border-zinc-700"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            {/* Dialog Action (Approve/Reject/Collect) */}
            <Dialog open={!!selectedLoan && actionType !== 'view_schedule'} onOpenChange={(open) => !open && setSelectedLoan(null)}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>
                            {actionType === 'collect' ? 'Recouvrement Forcé' : (actionType === 'approve' ? 'Approuver le Prêt' : 'Rejeter la demande')}
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            {actionType === 'collect' 
                                ? "Si le solde du client est suffisant, l'échéance sera prélevée. SINON, une pénalité sera ajoutée à sa dette totale."
                                : (actionType === 'approve' 
                                    ? "En approuvant, les fonds seront immédiatement transférés au client."
                                    : "Cette action annulera la demande de crédit.")
                            }
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between"><span>Client:</span><span className="font-bold">{selectedLoan?.full_name}</span></div>
                        <div className="flex justify-between"><span>ID Wallet:</span><span className="font-mono text-primary">{selectedLoan?.id_wallet}</span></div>
                        {actionType === 'collect' && (
                            <div className="flex justify-between border-t pt-2 mt-2 font-bold text-lg text-yellow-500">
                                <span>Échéance visée:</span>
                                <span>{parseFloat(selectedLoan?.monthly_payment).toFixed(2)} {selectedLoan?.currency}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-center block">PIN Super Agent requis</Label>
                        <div className="flex justify-center py-2">
                            <InputOTP maxLength={4} value={pin} onChange={setPin}>
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSelectedLoan(null)}>Annuler</Button>
                        <Button 
                            onClick={handleConfirmAction} 
                            disabled={isProcessing || pin.length < 4} 
                            variant={actionType === 'reject' ? 'destructive' : 'default'}
                            className={cn(actionType === 'collect' && "bg-yellow-600 hover:bg-yellow-700 text-white")}
                        >
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Confirmer l'Action
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog PIN — Recouvrement national */}
            <Dialog
                open={isCountryPinDialogOpen}
                onOpenChange={(open) => {
                    if (!isCountryCollecting) {
                        setIsCountryPinDialogOpen(open);
                        if (!open) setPin('');
                    }
                }}
            >
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Recouvrement national</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Les échéances arrivées à échéance ou dépassées seront traitées.
                            Les échéances futures ne seront pas prélevées.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Super Agent :</span>
                            <span className="font-bold">
                                {superAgent?.full_name || superAgent?.name || '—'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Territoire :</span>
                            <span className="font-bold">
                                {superAgent?.country || '—'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-center block">
                            PIN Super Agent requis
                        </Label>

                        <div className="flex justify-center py-3">
                            <InputOTP
                                maxLength={4}
                                value={pin}
                                onChange={(value) => setPin(value.replace(/\D/g, ''))}
                                inputMode="numeric"
                                disabled={isCountryCollecting}
                            >
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                    <InputOTPSlot index={3} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setPin('');
                                setIsCountryPinDialogOpen(false);
                            }}
                            disabled={isCountryCollecting}
                        >
                            Annuler
                        </Button>

                        <Button
                            onClick={handleCountryLoanCollection}
                            disabled={isCountryCollecting || pin.length !== 4}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold"
                        >
                            {isCountryCollecting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {isCountryCollecting
                                ? 'Recouvrement en cours...'
                                : 'Confirmer le recouvrement'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog Échéancier */}
            <Dialog open={!!selectedLoan && actionType === 'view_schedule'} onOpenChange={(open) => !open && setSelectedLoan(null)}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Échéancier : {selectedLoan?.full_name}</DialogTitle>
                        <DialogDescription>Plan de remboursement et statut des paiements.</DialogDescription>
                    </DialogHeader>
                    
                    <ScrollArea className="max-h-[400px] mt-4">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-800 hover:bg-transparent">
                                    <TableHead className="text-zinc-500">Date Prévue</TableHead>
                                    <TableHead className="text-zinc-500">Montant</TableHead>
                                    <TableHead className="text-right text-zinc-500">Statut</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedLoan && getSchedule(selectedLoan).map((item, idx) => {
                                    const isDueToday = !item.isPaid && isToday(item.dueDate);
                                    const isMissed = !item.isPaid && isPast(item.dueDate) && !isToday(item.dueDate);
                                    return (
                                        <TableRow key={idx} className="border-zinc-800">
                                            <TableCell className="text-sm">{format(item.dueDate, 'dd MMMM yyyy', { locale: fr })}</TableCell>
                                            <TableCell className="font-mono">{item.amount.toFixed(2)} {selectedLoan.currency}</TableCell>
                                            <TableCell className="text-right">
                                                {item.isPaid ? (
                                                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30">PAYÉ</Badge>
                                                ) : isDueToday ? (
                                                    <Badge className="bg-green-600/20 text-green-400 border-green-500/30">ACTIVE — REMBOURSEMENT AUTOMATIQUE</Badge>
                                                ) : isMissed ? (
                                                    <Badge className="bg-red-500/20 text-red-500 border-red-500/30 animate-pulse">IMPAYÉ</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-zinc-500 border-zinc-700">À VENIR</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSelectedLoan(null)}>Fermer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {superAgent?.role === 'SuperAgent' && (
                <div className="mb-4 flex justify-end">
                    <Button
                        onClick={() => {
                            setPin('');
                            setIsCountryPinDialogOpen(true);
                        }}
                        disabled={isCountryCollecting || isLoading}
                        className="bg-green-600 hover:bg-green-700 font-bold"
                    >
                        {isCountryCollecting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Recouvrement en cours...
                            </>
                        ) : (
                            <>
                                <Banknote className="h-4 w-4 mr-2" />
                                Lancer le recouvrement des échéances actives
                            </>
                        )}
                    </Button>
                </div>
            )}

            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700 hover:bg-transparent">
                                <TableHead className="text-zinc-400">Client / Réf</TableHead>
                                <TableHead className="text-zinc-400">Dette Restante</TableHead>
                                <TableHead className="text-zinc-400">Prochaine Échéance</TableHead>
                                <TableHead className="text-zinc-400">Statut</TableHead>
                                <TableHead className="text-zinc-400 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-8 w-8"/></TableCell></TableRow>
                            ) : filtered.length > 0 ? filtered.map(loan => {
                                const schedule = getSchedule(loan);
                                const nextDue = schedule.find(s => !s.isPaid && (s.remaining == null || Number(s.remaining) > 0.005));
                                const isLate = nextDue && isPast(nextDue.dueDate) && !isToday(nextDue.dueDate);

                                return (
                                    <TableRow key={loan.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                        <TableCell>
                                            <p className="font-bold text-sm">{loan.full_name}</p>
                                            <p className="text-[10px] text-zinc-500 font-mono">#{loan.id} • {loan.phone}</p>
                                        </TableCell>
                                        <TableCell>
                                            <p className="font-bold text-red-400">{parseFloat(loan.remaining_balance).toLocaleString()} {loan.currency}</p>
                                            <p className="text-[9px] text-zinc-500 uppercase">Sur {parseFloat(loan.amount).toLocaleString()} initiaux</p>
                                        </TableCell>
                                        <TableCell>
                                            {nextDue ? (
                                                <div>
                                                    <p className={cn("text-xs font-bold", isLate ? "text-red-500" : "text-zinc-300")}>
                                                        {format(nextDue.dueDate, 'dd/MM/yyyy')}
                                                    </p>
                                                    <p className="text-[10px] text-zinc-500">{Number(nextDue.amount ?? nextDue.remaining ?? 0).toFixed(2)} {loan.currency}</p>
                                                </div>
                                            ) : <span className="text-xs text-green-500">Clôturé</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={cn(
                                                "text-[9px] uppercase font-bold px-2 py-0.5",
                                                loan.status === 'approved' ? (isLate ? "bg-red-600 animate-pulse" : "bg-green-600") : "bg-zinc-600"
                                            )}>
                                                {loan.status === 'approved' && isLate ? 'En Retard' : loan.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="ghost" onClick={() => handleOpenAction(loan, 'view_schedule')} title="Voir l'échéancier">
                                                    <Calendar className="h-4 w-4"/>
                                                </Button>
                                                
                                                {loan.status === 'pending' ? (
                                                    <>
                                                        <Button size="sm" variant="outline" className="h-8 border-green-600 text-green-500" onClick={() => handleOpenAction(loan, 'approve')}>
                                                            Approuver
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-8 text-red-400" onClick={() => handleOpenAction(loan, 'reject')}>
                                                            <XCircle className="h-4 w-4"/>
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button 
                                                        size="sm" 
                                                        disabled={!nextDue || loan.status !== 'approved'}
                                                        className={cn("h-8 font-bold", isLate ? "bg-red-600 hover:bg-red-700" : "bg-zinc-700")}
                                                        onClick={() => handleOpenAction(loan, 'collect')}
                                                    >
                                                        <Banknote className="h-4 w-4 mr-1"/> Prélever
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            }) : <TableRow><TableCell colSpan={5} className="text-center py-20 text-zinc-500">Aucun prêt détecté.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
