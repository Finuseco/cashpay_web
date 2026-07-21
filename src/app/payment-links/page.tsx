'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    PlusCircle, Link as LinkIcon, Share2, Eye, 
    MoreVertical, Trash2, Power, PowerOff, 
    BarChart3, Coins, Loader2, ExternalLink 
} from 'lucide-react';
import { getPaymentLinks, togglePaymentLinkStatus, deletePaymentLink, type PaymentLink } from '@/lib/actions/payment-link.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import Link from 'next/link';

export default function PaymentLinksDashboard() {
    const [links, setLinks] = useState<PaymentLink[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();

    const fetchLinks = async () => {
        setIsLoading(true);
        const user = await getAuthenticatedUser();
        if (user) {
            const data = await getPaymentLinks(user.id);
            setLinks(data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchLinks();
    }, []);

    const handleToggleStatus = async (link: PaymentLink) => {
        const result = await togglePaymentLinkStatus(link.id, link.status);
        if (result.success) {
            toast({ title: link.status === 'active' ? 'Lien désactivé' : 'Lien activé', variant: 'success' });
            fetchLinks();
        }
    };

    const handleDelete = (link: PaymentLink) => {
        openAlert({
            title: "Supprimer le lien ?",
            description: "Cette action est irréversible. Les personnes disposant du lien ne pourront plus l'utiliser.",
            variant: "destructive",
            showCancel: true,
            onClose: async (confirmed) => {
                if (confirmed) {
                    const result = await deletePaymentLink(link.id);
                    if (result.success) {
                        toast({ title: 'Lien supprimé' });
                        fetchLinks();
                    }
                }
            }
        });
    };

    const handleCopy = (id: number) => {
        const url = `${window.location.origin}/pay/l_${id}`;
        navigator.clipboard.writeText(url);
        toast({ title: "Lien copié !", description: "Vous pouvez maintenant le partager." });
    };

    const totalCollected = links.reduce((sum, l) => sum + l.collectedAmount, 0);

    return (
        <DashboardLayout pageTitleKey="Mes Liens de Paiement">
            <main className="flex-1 p-4 md:p-8 space-y-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <h1 className="text-3xl font-black tracking-tighter">Payment Links</h1>
                            <p className="text-muted-foreground">Créez des pages de paiement publiques pour vos projets, dons ou services.</p>
                        </div>
                        <Button asChild variant="gradient" size="lg" className="font-bold shadow-lg">
                            <Link href="/payment-links/create">
                                <PlusCircle className="mr-2 h-5 w-5" /> Créer un lien
                            </Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-primary text-primary-foreground">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-bold uppercase opacity-70">Collecte Totale</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-black">${totalCollected.toFixed(2)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Liens Actifs</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-black">{links.filter(l => l.status === 'active').length}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Vues Totales</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-black text-primary">{links.reduce((sum, l) => sum + l.visitCount, 0)}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4">
                        {isLoading ? (
                            <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
                        ) : links.length > 0 ? (
                            links.map(link => (
                                <Card key={link.id} className={cn("overflow-hidden transition-all", link.status === 'inactive' && "opacity-60")}>
                                    <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-6">
                                        <div className="relative h-24 w-24 rounded-2xl bg-muted overflow-hidden shrink-0 border">
                                            {link.imageUrl ? (
                                                <Image src={link.imageUrl} alt={link.title} fill className="object-cover" />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center bg-primary/5">
                                                    <LinkIcon className="h-8 w-8 text-primary/30" />
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
                                            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2">
                                                <h3 className="text-lg font-bold truncate">{link.title}</h3>
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold">{link.category}</Badge>
                                                <Badge className={cn("text-[9px] uppercase", link.status === 'active' ? "bg-green-500" : "bg-zinc-500")}>
                                                    {link.status === 'active' ? 'En ligne' : 'Désactivé'}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-1">{link.description}</p>
                                            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-4 text-xs font-medium text-zinc-500 pt-2">
                                                <span className="flex items-center gap-1"><Eye className="h-3 w-3"/> {link.visitCount} vues</span>
                                                <span className="flex items-center gap-1 text-primary"><Coins className="h-3 w-3"/> ${link.collectedAmount.toFixed(2)} collectés</span>
                                                <span>Créé le {format(new Date(link.createdAt), 'dd MMM yyyy', { locale: fr })}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                            <Button variant="outline" className="font-bold" onClick={() => handleCopy(link.id)}>
                                                <Share2 className="mr-2 h-4 w-4" /> Partager
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreVertical /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/pay/l_${link.id}`} target="_blank">
                                                            <ExternalLink className="mr-2 h-4 w-4"/> Voir la page
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleToggleStatus(link)}>
                                                        {link.status === 'active' ? <><PowerOff className="mr-2 h-4 w-4"/> Désactiver</> : <><Power className="mr-2 h-4 w-4"/> Activer</>}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-red-500 focus:text-red-500 focus:bg-red-50" onClick={() => handleDelete(link)}>
                                                        <Trash2 className="mr-2 h-4 w-4"/> Supprimer
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-3xl">
                                <LinkIcon className="h-16 w-16 mx-auto text-muted-foreground opacity-20 mb-4" />
                                <p className="font-bold text-lg">Aucun lien de paiement</p>
                                <p className="text-sm text-muted-foreground mt-1">Générez votre premier lien pour commencer à collecter des fonds.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </DashboardLayout>
    );
}

import Image from 'next/image';
