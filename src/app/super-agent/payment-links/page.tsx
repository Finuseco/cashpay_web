'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Link as LinkIcon, Ban, CheckCircle2, ShieldAlert, Eye } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCountryPaymentLinks, superAgentBlockLink, type PaymentLink } from '@/lib/actions/payment-link.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function SuperAgentPaymentLinks() {
    const [links, setLinks] = useState<PaymentLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [superAgent, setSuperAgent] = useState<any>(null);
    const [filter, setFilter] = useState('');
    const [isProcessing, setIsProcessing] = useState<number | null>(null);
    
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();

    const fetchData = async () => {
        setIsLoading(true);
        const current = await getAuthenticatedUser();
        setSuperAgent(current);
        if (current?.country) {
            const data = await getCountryPaymentLinks(current.country);
            setLinks(data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleBlockToggle = (link: PaymentLink) => {
        const isBlocked = link.status === 'blocked';
        const actionText = isBlocked ? 'DÉBLOQUER' : 'BLOQUER';

        openAlert({
            title: `${actionText} le lien ?`,
            description: `Voulez-vous vraiment ${actionText.toLowerCase()} ce lien de paiement ? ${isBlocked ? "Il redeviendra utilisable par le public." : "Toute transaction sur ce lien sera techniquement impossible."}`,
            variant: isBlocked ? "info" : "destructive",
            showCancel: true,
            onClose: async (confirmed) => {
                if (confirmed) {
                    setIsProcessing(link.id);
                    const result = await superAgentBlockLink({
                        linkId: link.id,
                        adminId: superAgent.id,
                        status: isBlocked ? 'active' : 'blocked',
                        reason: "Signalement ou suspicion d'arnaque"
                    });
                    setIsProcessing(null);

                    if (result.success) {
                        toast({ title: isBlocked ? "Lien réactivé" : "Lien bloqué", variant: "success" });
                        fetchData();
                    } else {
                        openAlert({ title: "Erreur", description: result.error, variant: 'error' });
                    }
                }
            }
        });
    };

    const filtered = links.filter(l => 
        l.title.toLowerCase().includes(filter.toLowerCase()) ||
        l.ownerName?.toLowerCase().includes(filter.toLowerCase()) ||
        l.ownerWalletId?.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><LinkIcon className="text-primary"/> Modération Payment Links</h1>
                    <p className="text-sm text-zinc-400">Surveillance et blocage des liens de collecte sur votre territoire.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input 
                        placeholder="Rechercher titre ou auteur..." 
                        className="pl-9 bg-zinc-800 border-zinc-700 h-11 text-white"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardHeader>
                    <CardTitle>Journal des liens de collecte nationaux</CardTitle>
                    <CardDescription className="text-zinc-400">Juridiction : <strong>{superAgent?.country}</strong></CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700 hover:bg-transparent">
                                <TableHead className="text-zinc-400">Lien / Catégorie</TableHead>
                                <TableHead className="text-zinc-400">Créateur</TableHead>
                                <TableHead className="text-zinc-400">Collecte</TableHead>
                                <TableHead className="text-zinc-400">Statut</TableHead>
                                <TableHead className="text-right text-zinc-400">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-8 w-8"/></TableCell></TableRow>
                            ) : filtered.length > 0 ? filtered.map(link => (
                                <TableRow key={link.id} className={cn("border-zinc-700 hover:bg-zinc-700/30 transition-colors", link.status === 'blocked' && "bg-red-900/10")}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <p className="font-bold text-sm text-primary">{link.title}</p>
                                            <Badge variant="outline" className="w-fit text-[9px] h-4 border-zinc-600 mt-1">{link.category}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm font-semibold">{link.ownerName}</p>
                                        <p className="text-[10px] text-zinc-500 font-mono">{link.ownerWalletId}</p>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <p className="text-sm font-black">${link.collectedAmount.toFixed(2)}</p>
                                            <p className="text-[10px] text-zinc-500 uppercase">{link.visitCount} vues</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "text-[9px] uppercase font-black px-2 py-0.5",
                                            link.status === 'active' ? "bg-green-600" : 
                                            link.status === 'inactive' ? "bg-zinc-600" : "bg-red-600"
                                        )}>
                                            {link.status === 'active' ? 'En ligne' : link.status === 'inactive' ? 'Désactivé' : 'BLOQUÉ'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-zinc-400 hover:text-white">
                                                <Link href={`/pay/l_${link.id}`} target="_blank"><Eye className="h-4 w-4"/></Link>
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className={cn("h-8 w-8", link.status === 'blocked' ? "text-green-400 hover:bg-green-400/10" : "text-red-400 hover:bg-red-400/10")}
                                                onClick={() => handleBlockToggle(link)}
                                                disabled={isProcessing === link.id}
                                            >
                                                {isProcessing === link.id ? <Loader2 className="h-4 w-4 animate-spin"/> : link.status === 'blocked' ? <CheckCircle2 className="h-4 w-4"/> : <Ban className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={5} className="text-center py-20 text-zinc-500 italic">Aucun lien de collecte trouvé dans cette zone.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}