'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, DollarSign, ShoppingCart, Link as LinkIcon, Settings, UserPlus, Eye, ChevronRight, Network, Cog, Loader2, BarChart3, ListTree } from 'lucide-react';
import type { Product, User, MlmProductSettings } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { formatKiloMega } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { MlmProductSettingsForm } from './mlm-product-settings-form';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { saveMlmProductSettings, getMlmCommissions, updateRankSettings } from '@/lib/actions/mlm.actions';
import { format } from 'date-fns';
import { Input } from '../ui/input';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string, icon: React.ElementType, description?: string }) => (
    <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-[10px] text-muted-foreground mt-1">{description}</p>}
        </CardContent>
    </Card>
);

const PayoutsTab = ({ partner }: { partner: any }) => {
    const [commissions, setCommissions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCommissions = async () => {
            setIsLoading(true);
            const data = await getMlmCommissions(partner.user_id);
            setCommissions(data);
            setIsLoading(false);
        };
        fetchCommissions();
    }, [partner.user_id]);

    return (
        <Card>
            <CardHeader><CardTitle>Historique des Commissions</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">Montant</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="text-center">Chargement...</TableCell></TableRow>
                        ) : commissions.length > 0 ? commissions.map(c => (
                            <TableRow key={c.id}>
                                <TableCell>{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                <TableCell className="capitalize">{c.commission_type}</TableCell>
                                <TableCell>{c.source_user_name || 'Vente directe'}</TableCell>
                                <TableCell className="text-right font-semibold text-green-500">+${c.amount.toFixed(2)}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={4} className="text-center">Aucune commission pour le moment.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

const RanksTab = ({ partner }: { partner: any }) => {
    const [ranks, setRanks] = useState(partner.ranks || []);
    const [isSaving, setIsSaving] = useState(false);
    const { openAlert } = useAlertDialog();

    const handleRankChange = (index: number, field: string, value: any) => {
        const newRanks = [...ranks];
        newRanks[index] = { ...newRanks[index], [field]: value };
        setRanks(newRanks);
    };

    const handleSaveRanks = async () => {
        setIsSaving(true);
        const result = await updateRankSettings(partner.id, ranks);
        if (result.success) {
            openAlert({ title: 'Succès', description: 'Les paramètres des rangs ont été enregistrés.', variant: 'success' });
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
        setIsSaving(false);
    };
    
    return (
         <Card>
            <CardHeader>
                <CardTitle>Configuration des Rangs</CardTitle>
                <CardDescription>Définissez les conditions pour que les membres de votre réseau progressent.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom du Rang</TableHead>
                                <TableHead>PV Personnel Min.</TableHead>
                                <TableHead>PV Groupe Min.</TableHead>
                                <TableHead>Filleuls Directs Min.</TableHead>
                                <TableHead>Niveaux de Commission</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ranks.map((rank: any, index: number) => (
                                <TableRow key={rank.id}>
                                    <TableCell><Input value={rank.name} onChange={(e) => handleRankChange(index, 'name', e.target.value)} /></TableCell>
                                    <TableCell><Input type="number" value={rank.min_ppv} onChange={(e) => handleRankChange(index, 'min_ppv', Number(e.target.value))} /></TableCell>
                                    <TableCell><Input type="number" value={rank.min_gv} onChange={(e) => handleRankChange(index, 'min_gv', Number(e.target.value))} /></TableCell>
                                    <TableCell><Input type="number" value={rank.min_direct_referrals} onChange={(e) => handleRankChange(index, 'min_direct_referrals', Number(e.target.value))} /></TableCell>
                                    <TableCell><Input type="number" value={rank.commission_levels} onChange={(e) => handleRankChange(index, 'commission_levels', Number(e.target.value))} /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 <Button onClick={handleSaveRanks} className="mt-4" disabled={isSaving}>
                     {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                     Enregistrer les Modifications
                </Button>
            </CardContent>
        </Card>
    )
}


export function NetworkMarketingPartnerDashboard({ partner, products }: { partner: any, products: Product[] }) {
    const { openAlert } = useAlertDialog();
    const [mlmProducts, setMlmProducts] = useState<Set<string>>(new Set(partner.products.map((p: any) => p.id.toString())));
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    
    const handleToggleProduct = (productId: string) => {
        setMlmProducts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) {
                newSet.delete(productId);
            } else {
                newSet.add(productId);
            }
            return newSet;
        });
    };
    
    const handleSaveSettings = async (settings: Omit<MlmProductSettings, 'partnerId'>) => {
        const result = await saveMlmProductSettings(partner.id, settings);
        if (result.success) {
            openAlert({ title: 'Succès', description: 'Les paramètres du produit ont été enregistrés.', variant: 'success' });
            setIsConfigOpen(false);
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };
    
    const summary = partner.summary || { networkSales: 25400.50, commissions: 1270.03, memberCount: 152 };

    return (
        <div className="space-y-6">
             <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Configurer le Produit MLM</DialogTitle>
                        <DialogDescription>Définissez les points et commissions pour "{editingProduct?.name}".</DialogDescription>
                    </DialogHeader>
                    {editingProduct && <MlmProductSettingsForm product={editingProduct} onSave={handleSaveSettings} />}
                </DialogContent>
            </Dialog>

            <div className="grid md:grid-cols-3 gap-4">
                <StatCard title="Ventes du Réseau" value={`${summary.networkSales.toLocaleString()} ${partner.commission_currency}`} icon={ShoppingCart} description="Volume total sur les 30 derniers jours" />
                <StatCard title="Commissions Payées" value={`${summary.commissions.toLocaleString()} ${partner.commission_currency}`} icon={DollarSign} description="Rémunération totale du réseau" />
                <StatCard title="Membres du Réseau" value={formatKiloMega(summary.memberCount)} icon={Users} description="Vendeurs actifs dans votre arbre" />
            </div>
            
            <Tabs defaultValue="products" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-muted/50 h-auto p-1">
                    <TabsTrigger value="products" className="py-2"><ShoppingCart className="mr-2 h-4 w-4 hidden sm:inline" />Produits</TabsTrigger>
                    <TabsTrigger value="ranks" className="py-2"><BarChart3 className="mr-2 h-4 w-4 hidden sm:inline" />Rangs</TabsTrigger>
                    <TabsTrigger value="network" className="py-2"><ListTree className="mr-2 h-4 w-4 hidden sm:inline" />Arbre</TabsTrigger>
                    <TabsTrigger value="payouts" className="py-2"><DollarSign className="mr-2 h-4 w-4 hidden sm:inline" />Gains</TabsTrigger>
                </TabsList>

                <TabsContent value="products" className="mt-4 space-y-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>Catalogue MLM</CardTitle>
                            <CardDescription>
                                Activez les produits de votre boutique JoJo que vous souhaitez inclure dans votre programme de marketing de réseau.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produit</TableHead>
                                            <TableHead>Prix Public</TableHead>
                                            <TableHead className="text-center">Statut MLM</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {products.length > 0 ? products.map(product => (
                                            <TableRow key={product.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Image src={product.image} alt={product.name} width={40} height={40} className="rounded-md object-cover bg-muted"/>
                                                        <span className="font-medium">{product.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>${product.sellingPrice.toFixed(2)}</TableCell>
                                                <TableCell className="text-center">
                                                    <Switch 
                                                        checked={mlmProducts.has(product.id.toString())} 
                                                        onCheckedChange={() => handleToggleProduct(product.id.toString())}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                     <Button variant="outline" size="sm" disabled={!mlmProducts.has(product.id.toString())} onClick={() => { setEditingProduct(product); setIsConfigOpen(true); }}>
                                                        <Cog className="mr-2 h-4 w-4" /> Configurer
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun produit trouvé dans votre boutique.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                 <TabsContent value="ranks" className="mt-4">
                    <RanksTab partner={partner} />
                 </TabsContent>

                 <TabsContent value="network" className="mt-4">
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><Network className="h-5 w-5"/>Arbre Binaire</CardTitle><CardDescription>Visualisez la structure complète de votre réseau.</CardDescription></CardHeader>
                            <CardContent>
                                <Button asChild className="w-full h-24 text-lg">
                                    <Link href="/mlm/network-marketing/tree">
                                        Voir l'Arbre Généalogique
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5"/>Filleuls Directs</CardTitle><CardDescription>Vos recrues directes récentes.</CardDescription></CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                {partner.directReferrals?.length > 0 ? partner.directReferrals.map((member: any) => (
                                    <div key={member.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                        <div className="flex items-center gap-3">
                                             <Avatar className="h-10 w-10">
                                                <AvatarImage src={member.profile_photo || undefined} />
                                                <AvatarFallback>{member.full_name.slice(0,2)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-semibold text-sm">{member.full_name}</p>
                                                <p className="text-[10px] text-muted-foreground">Rang: {member.rank}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4"/></Button>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground text-center py-4">Aucun parrainage direct pour le moment.</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="payouts" className="mt-4">
                    <PayoutsTab partner={partner} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
