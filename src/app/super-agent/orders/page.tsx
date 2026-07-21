
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, PackageSearch, Search, CreditCard, ShoppingBag } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCountryOrders, getCountryCardRequests } from '@/lib/actions/super-agent/logistics.actions';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Helper pour formater les dates en toute sécurité
const formatDateSafe = (dateValue: any, formatStr: string = 'dd/MM HH:mm') => {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    if (!isValid(date)) return 'N/A';
    return format(date, formatStr, { locale: fr });
};

export default function NationalOrdersPage() {
    const [jojoOrders, setJojoOrders] = useState<any[]>([]);
    const [cardOrders, setCardOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            const current = await getAuthenticatedUser();
            if (current?.country) {
                const [jojoData, cardData] = await Promise.all([
                    getCountryOrders(current.country),
                    getCountryCardRequests(current.country)
                ]);
                setJojoOrders(jojoData);
                setCardOrders(cardData);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const filteredJojo = jojoOrders.filter(o => 
        o.reference.toLowerCase().includes(filter.toLowerCase()) ||
        o.buyerName?.toLowerCase().includes(filter.toLowerCase()) ||
        o.productName?.toLowerCase().includes(filter.toLowerCase())
    );

    const filteredCards = cardOrders.filter(o => 
        o.id_wallet?.toLowerCase().includes(filter.toLowerCase()) ||
        o.full_name?.toLowerCase().includes(filter.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'paid': return 'bg-blue-500';
            case 'shipped': return 'bg-purple-500';
            case 'delivered': return 'bg-green-500';
            case 'completed': return 'bg-green-500';
            case 'pending': return 'bg-amber-500';
            case 'cancelled': return 'bg-red-500';
            default: return 'bg-zinc-600';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <PackageSearch className="text-primary"/> Poursuite des Commandes Nationales
                    </h1>
                    <p className="text-sm text-zinc-400">Surveillance et modération des flux logistiques (Produits & Cartes).</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input 
                        placeholder="Rechercher une commande..." 
                        className="pl-9 bg-zinc-800 border-zinc-700"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <Tabs defaultValue="jojo" className="w-full">
                <TabsList className="bg-zinc-800 border-zinc-700">
                    <TabsTrigger value="jojo"><ShoppingBag className="h-4 w-4 mr-2"/> Commandes JoJo Market</TabsTrigger>
                    <TabsTrigger value="cards"><CreditCard className="h-4 w-4 mr-2"/> Commandes de Cartes</TabsTrigger>
                </TabsList>

                <TabsContent value="jojo" className="mt-4">
                    <Card className="bg-zinc-800 border-zinc-700 text-white">
                        <CardHeader>
                            <CardTitle>Journal des Ventes Produits</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-700 hover:bg-transparent">
                                        <TableHead className="text-zinc-400">Date</TableHead>
                                        <TableHead className="text-zinc-400">Référence</TableHead>
                                        <TableHead className="text-zinc-400">Article</TableHead>
                                        <TableHead className="text-zinc-400">Acheteur / Vendeur</TableHead>
                                        <TableHead className="text-zinc-400">Statut</TableHead>
                                        <TableHead className="text-right text-zinc-400">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                                    ) : filteredJojo.length > 0 ? filteredJojo.map(order => (
                                        <TableRow key={order.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                            <TableCell className="text-xs text-zinc-500">{formatDateSafe(order.createdAt)}</TableCell>
                                            <TableCell className="font-mono text-xs text-primary">{order.reference}</TableCell>
                                            <TableCell><p className="text-sm font-semibold truncate max-w-[150px]">{order.productName}</p></TableCell>
                                            <TableCell>
                                                <p className="text-sm font-bold">{order.buyerName}</p>
                                                <p className="text-[10px] text-zinc-400">Magasin: {order.seller?.name}</p>
                                            </TableCell>
                                            <TableCell><Badge className={cn("uppercase text-[9px] font-bold", getStatusColor(order.status))}>{order.status}</Badge></TableCell>
                                            <TableCell className="text-right font-black">{parseFloat(order.totalPrice || 0).toFixed(2)} {order.currency}</TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={6} className="text-center py-10 text-zinc-500">Aucune commande JoJo trouvée.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cards" className="mt-4">
                    <Card className="bg-zinc-800 border-zinc-700 text-white">
                        <CardHeader>
                            <CardTitle>Demandes de Cartes Physiques</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-700 hover:bg-transparent">
                                        <TableHead className="text-zinc-400">Date</TableHead>
                                        <TableHead className="text-zinc-400">Client</TableHead>
                                        <TableHead className="text-zinc-400">ID Portefeuille</TableHead>
                                        <TableHead className="text-zinc-400">Type / Devise</TableHead>
                                        <TableHead className="text-zinc-400">Statut</TableHead>
                                        <TableHead className="text-right text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                                    ) : filteredCards.length > 0 ? filteredCards.map(req => (
                                        <TableRow key={req.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                            <TableCell className="text-xs text-zinc-500">{formatDateSafe(req.createdAt)}</TableCell>
                                            <TableCell><p className="font-bold text-sm">{req.full_name}</p></TableCell>
                                            <TableCell className="font-mono text-xs">{req.id_wallet}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="uppercase border-zinc-600 mr-2">{req.brand}</Badge>
                                                <span className="text-xs font-bold text-primary">{req.currency}</span>
                                            </TableCell>
                                            <TableCell><Badge className={cn("uppercase text-[9px] font-bold", getStatusColor(req.status))}>{req.status}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="ghost" className="h-8 text-xs">Gérer</Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={6} className="text-center py-10 text-zinc-500">Aucune commande de carte trouvée.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
