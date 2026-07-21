
'use client';

import { useState, useEffect } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCountryPendingDeposits } from '@/lib/actions/super-agent/finance.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Search, RefreshCcw, Smartphone, CreditCard, Bitcoin, Landmark } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function SuperAgentSupport() {
    const [deposits, setDeposits] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('');

    const fetchData = async () => {
        setIsLoading(true);
        const current = await getAuthenticatedUser();
        if (current?.country) {
            const data = await getCountryPendingDeposits(current.country);
            setDeposits(data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredDeposits = deposits.filter(d => 
        d.reference_code.toLowerCase().includes(filter.toLowerCase()) ||
        d.full_name.toLowerCase().includes(filter.toLowerCase())
    );

    const getDepositTypeIcon = (meta: any) => {
        const provider = meta?.provider?.toLowerCase() || '';
        if (['airtel', 'mpesa', 'orange', 'mtn'].some(p => provider.includes(p))) return <Smartphone className="h-4 w-4 text-blue-400" />;
        if (provider.includes('card')) return <CreditCard className="h-4 w-4 text-emerald-400" />;
        if (provider.includes('crypto')) return <Bitcoin className="h-4 w-4 text-amber-400" />;
        return <Landmark className="h-4 w-4 text-zinc-400" />;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Flux Entrants & Support</h1>
                    <p className="text-sm text-zinc-400">Contrôlez les dépôts en attente de crédit sur votre territoire.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                    <RefreshCcw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}/> Actualiser
                </Button>
            </div>

            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <CardTitle>Journal des Dépôts Non Crédités</CardTitle>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <Input 
                                placeholder="Chercher une référence..." 
                                className="pl-9 bg-zinc-900 border-zinc-700"
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700">
                                <TableHead className="text-zinc-400">Date</TableHead>
                                <TableHead className="text-zinc-400">Origine</TableHead>
                                <TableHead className="text-zinc-400">Client</TableHead>
                                <TableHead className="text-zinc-400">Montant</TableHead>
                                <TableHead className="text-right text-zinc-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                            ) : filteredDeposits.length > 0 ? filteredDeposits.map(d => (
                                <TableRow key={d.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                    <TableCell className="text-xs text-zinc-500">{format(new Date(d.created_at), 'dd/MM HH:mm')}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getDepositTypeIcon(d.metadata)}
                                            <span className="text-[10px] font-bold uppercase">{d.metadata?.provider || 'Banque'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-bold text-sm">{d.full_name}</p>
                                        <p className="text-[10px] font-mono text-zinc-500">{d.reference_code}</p>
                                    </TableCell>
                                    <TableCell className="font-bold text-green-400">+{parseFloat(d.amount).toFixed(2)} {d.currency}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="outline" className="border-zinc-600 hover:bg-primary hover:text-white">Créditer Manuellement</Button>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={5} className="text-center py-10 text-zinc-500">Aucun dépôt bloqué détecté.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
