
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { 
    getCountrySubAgents, 
    promoteToSubSuperAgent, 
    getInterventionHistory 
} from '@/lib/actions/super-agent/staff.actions';
import { 
    getCountryAgentSubscriptions, 
    forceAgentRenewal 
} from '@/lib/actions/agent-application.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, ShieldCheck, History, MapPin, Loader2, CheckCircle2, Briefcase, RefreshCw, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PROVINCES_BY_COUNTRY } from '@/lib/provinces';
import { countryToCode, cn } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { InternationalWalletInput } from '@/components/shared/international-wallet-input';
import type { WalletInfo } from '@/lib/actions/wallet.actions';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const promotionSchema = z.object({
  walletId: z.string().min(12, "L'ID du portefeuille est requis."),
  province: z.string().min(1, "Veuillez sélectionner une province."),
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

export default function SubAgentsPage() {
    const [subAgents, setSubAgents] = useState<any[]>([]);
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPromotionOpen, setIsPromotionOpen] = useState(false);
    const [isRenewalOpen, setIsRenewalOpen] = useState(false);
    const [selectedAgentForRenewal, setSelectedAgentForRenewal] = useState<any>(null);
    const [renewalPin, setRenewalPin] = useState('');
    const [superAgent, setSuperAgent] = useState<any>(null);
    const [provinces, setProvinces] = useState<string[]>([]);
    const [verifiedUser, setVerifiedUser] = useState<WalletInfo | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof promotionSchema>>({
        resolver: zodResolver(promotionSchema),
        defaultValues: { walletId: '', pin: '', province: '' },
    });

    const fetchData = async () => {
        setIsLoading(true);
        const current = await getAuthenticatedUser();
        if (current?.country) {
            setSuperAgent(current);
            const code = countryToCode(current.country);
            if (code) setProvinces(PROVINCES_BY_COUNTRY[code] || []);

            const [agents, logs, subs] = await Promise.all([
                getCountrySubAgents(current.country),
                getInterventionHistory(current.country),
                getCountryAgentSubscriptions(current.country)
            ]);
            setSubAgents(agents);
            setAuditLogs(logs);
            setSubscriptions(subs);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handlePromotion = async (values: z.infer<typeof promotionSchema>) => {
        if (!superAgent || !verifiedUser?.userId) return;
        setIsSubmitting(true);
        
        const result = await promoteToSubSuperAgent(superAgent.id, verifiedUser.userId, values.province, values.pin);
        
        setIsSubmitting(false);
        if (result.success) {
            openAlert({ 
                title: 'Sous-Agent Nommé !', 
                description: `${verifiedUser.userName} est désormais Sous-Super Agent provincial pour : ${values.province}.`, 
                variant: 'success' 
            });
            setIsPromotionOpen(false);
            form.reset();
            setVerifiedUser(null);
            fetchData();
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    const handleConfirmRenewal = async () => {
        if (!selectedAgentForRenewal || !superAgent) return;
        setIsSubmitting(true);
        
        const result = await forceAgentRenewal(superAgent.id, selectedAgentForRenewal.user_id, renewalPin);
        
        setIsSubmitting(false);
        if (result.success) {
            openAlert({ title: 'Régularisation Réussie', description: `L'agent ${selectedAgentForRenewal.full_name} a été réabonné pour 30 jours.`, variant: 'success' });
            setIsRenewalOpen(false);
            setRenewalPin('');
            fetchData();
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    const isNationalAdmin = superAgent?.role === 'SuperAgent' || superAgent?.role === 'Admin';

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Effectif & Abonnements</h1>
                    <p className="text-sm text-zinc-400">Gérez vos délégués et surveillez la validité des comptes agents.</p>
                </div>
                {isNationalAdmin && (
                    <Button onClick={() => setIsPromotionOpen(true)} variant="gradient">
                        <UserPlus className="h-4 w-4 mr-2"/> Nommer un Sous-Agent
                    </Button>
                )}
            </div>

            {/* Dialog Régularisation */}
            <Dialog open={isRenewalOpen} onOpenChange={setIsRenewalOpen}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Régulariser un Agent</DialogTitle>
                        <DialogDescription>
                            Cette action va débiter le compte de l'agent de 3 USD pour prolonger son accès de 30 jours.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 bg-muted/50 rounded-lg text-sm">
                        <p>Agent : <strong>{selectedAgentForRenewal?.full_name}</strong></p>
                        <p>Wallet : <strong>{selectedAgentForRenewal?.id_wallet}</strong></p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-center block text-sm">Entrez votre PIN Super Agent</label>
                        <div className="flex justify-center py-2">
                            <InputOTP maxLength={4} value={renewalPin} onChange={setRenewalPin}>
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRenewalOpen(false)}>Annuler</Button>
                        <Button onClick={handleConfirmRenewal} disabled={isSubmitting || renewalPin.length < 4} variant="gradient">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Confirmer le Débit & Renouveler
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Tabs defaultValue="list">
                <TabsList className="bg-zinc-800">
                    <TabsTrigger value="list"><ShieldCheck className="h-4 w-4 mr-2"/> Sous-Agents</TabsTrigger>
                    <TabsTrigger value="subscriptions"><Briefcase className="h-4 w-4 mr-2"/> État des Abonnements</TabsTrigger>
                    <TabsTrigger value="audit"><History className="h-4 w-4 mr-2"/> Journal</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="mt-4">
                    <Card className="bg-zinc-800 border-zinc-700 text-white">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-700">
                                        <TableHead className="text-zinc-400">Agent</TableHead>
                                        <TableHead className="text-zinc-400">Province</TableHead>
                                        <TableHead className="text-right text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                                    ) : subAgents.map(agent => (
                                        <TableRow key={agent.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8"><AvatarImage src={agent.profile_photo}/><AvatarFallback>{agent.full_name[0]}</AvatarFallback></Avatar>
                                                    <div>
                                                        <p className="text-sm font-bold">{agent.full_name}</p>
                                                        <p className="text-[10px] text-zinc-500">{agent.id_wallet}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="secondary" className="bg-zinc-700">{agent.province}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" className="text-red-400">Révoquer</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="subscriptions" className="mt-4">
                    <Card className="bg-zinc-800 border-zinc-700 text-white">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-700">
                                        <TableHead className="text-zinc-400">Titulaire</TableHead>
                                        <TableHead className="text-zinc-400">Date Expiration</TableHead>
                                        <TableHead className="text-zinc-400">Statut</TableHead>
                                        <TableHead className="text-right text-zinc-400">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {subscriptions.map(sub => {
                                        const isExpired = sub.current_period_end && isPast(new Date(sub.current_period_end));
                                        return (
                                            <TableRow key={sub.id} className="border-zinc-700">
                                                <TableCell>
                                                    <p className="font-bold text-sm">{sub.full_name}</p>
                                                    <p className="text-[10px] text-zinc-500 font-mono">{sub.id_wallet}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <p className={cn("text-xs", isExpired ? "text-red-500 font-bold" : "text-zinc-300")}>
                                                        {sub.current_period_end ? format(new Date(sub.current_period_end), 'dd/MM/yyyy') : 'N/A'}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn(sub.status === 'active' && !isExpired ? 'bg-green-500' : 'bg-red-600')}>
                                                        {isExpired ? 'EXPIRÉ' : sub.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" variant="outline" className="h-8" onClick={() => { setSelectedAgentForRenewal(sub); setIsRenewalOpen(true); }}>
                                                        <RefreshCw className="h-3 w-3 mr-1"/> Régulariser
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="audit" className="mt-4">
                    <Card className="bg-zinc-800 border-zinc-700 text-white">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-700">
                                        <TableHead className="text-zinc-400">Date</TableHead>
                                        <TableHead className="text-zinc-400">Action</TableHead>
                                        <TableHead className="text-zinc-400">Détail</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {auditLogs.map(log => (
                                        <TableRow key={log.id} className="border-zinc-700">
                                            <TableCell className="text-[10px]">{format(new Date(log.created_at), 'dd/MM HH:mm')}</TableCell>
                                            <TableCell><Badge variant="outline" className="text-[10px]">{log.action_type}</Badge></TableCell>
                                            <TableCell className="text-xs">{log.detail}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
