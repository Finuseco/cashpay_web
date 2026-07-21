
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Briefcase, Search, RefreshCw, Power } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { 
    getCountryBusinessPartners, 
    resetBusinessApiKey 
} from '@/lib/actions/super-agent/finance.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from "@/lib/utils";

export default function BusinessManagementPage() {
    const [partners, setPartners] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPartner, setSelectedPartner] = useState<any | null>(null);
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
            const { b2b } = await getCountryBusinessPartners(current.country);
            setPartners(b2b);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenReset = (partner: any) => {
        setSelectedPartner(partner);
        setPin('');
    };

    const handleConfirmReset = async () => {
        if (!selectedPartner || !superAgent) return;

        setIsProcessing(true);
        const result = await resetBusinessApiKey(selectedPartner.id, 'b2b', superAgent.id, pin);
        setIsProcessing(false);

        if (result.success) {
            openAlert({
                title: 'Clés réinitialisées',
                description: `De nouveaux accès ont été générés et envoyés par e-mail à ${selectedPartner.company_name}.`,
                variant: 'success'
            });
            setSelectedPartner(null);
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="text-primary"/> Partenaires Business</h1>
                    <p className="text-sm text-zinc-400">Gérez les accès API et le statut des entreprises partenaires.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input 
                        placeholder="Rechercher une entreprise..." 
                        className="pl-9 bg-zinc-800 border-zinc-700"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <Dialog open={!!selectedPartner} onOpenChange={(open) => !open && setSelectedPartner(null)}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Réinitialiser les Clés API</DialogTitle>
                        <DialogDescription>
                            Attention : Les anciennes clés de <strong>{selectedPartner?.company_name}</strong> seront immédiatement invalidées.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-2">
                        <Label className="text-center block">Entrez votre PIN Super Agent pour confirmer</Label>
                        <div className="flex justify-center py-2">
                            <InputOTP maxLength={4} value={pin} onChange={setPin}>
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSelectedPartner(null)}>Annuler</Button>
                        <Button onClick={handleConfirmReset} disabled={isProcessing || pin.length < 4} variant="destructive">
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
                                <TableHead className="text-zinc-400">Entreprise</TableHead>
                                <TableHead className="text-zinc-400">Propriétaire</TableHead>
                                <TableHead className="text-zinc-400">Statut</TableHead>
                                <TableHead className="text-right text-zinc-400">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                            ) : partners.length > 0 ? partners.map(p => (
                                <TableRow key={p.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                    <TableCell>
                                        <p className="font-bold text-sm">{p.company_name}</p>
                                        <p className="text-[10px] text-zinc-400">{p.company_email}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm">{p.owner_name}</p>
                                        <p className="text-[10px] text-zinc-500">{p.owner_wallet}</p>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(p.status === 'active' ? 'bg-green-500' : 'bg-zinc-600')}>
                                            {p.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="outline" className="h-8" onClick={() => handleOpenReset(p)}>
                                                <RefreshCw className="h-3 w-3 mr-1"/> API
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-8 text-red-400">
                                                <Power className="h-3 w-3"/>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={4} className="text-center py-10 text-zinc-500">Aucun partenaire B2B trouvé.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
