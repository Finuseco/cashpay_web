
'use client';

import { useState, useEffect } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCountryPayouts } from '@/lib/actions/super-agent/finance.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Landmark, Smartphone, Bitcoin, Search, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

export default function PayoutsPage() {
    const [payouts, setPayouts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            const current = await getAuthenticatedUser();
            if (current?.country) {
                const data = await getCountryPayouts(current.country);
                setPayouts(data);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const filteredPayouts = payouts.filter(p => 
        p.reference_code.toLowerCase().includes(filter.toLowerCase()) ||
        p.full_name.toLowerCase().includes(filter.toLowerCase())
    );

    const getProviderIcon = (type: string) => {
        if (type.includes('MOMO')) return <Smartphone className="h-4 w-4 text-blue-400" />;
        if (type.includes('BANKS')) return <Landmark className="h-4 w-4 text-emerald-400" />;
        if (type.includes('CRYPTO')) return <Bitcoin className="h-4 w-4 text-amber-400" />;
        return <ArrowUpRight className="h-4 w-4 text-zinc-400" />;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Flux Sortants (Payouts)</h1>
                    <p className="text-sm text-zinc-400">Surveillez les sorties de fonds nationales vers les banques et mobiles.</p>
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

            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardHeader>
                    <CardTitle>Journal des Paiements Sortants</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700">
                                <TableHead className="text-zinc-400">Date</TableHead>
                                <TableHead className="text-zinc-400">Canal</TableHead>
                                <TableHead className="text-zinc-400">Bénéficiaire</TableHead>
                                <TableHead className="text-zinc-400 text-right">Montant</TableHead>
                                <TableHead className="text-zinc-400 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                            ) : filteredPayouts.length > 0 ? filteredPayouts.map(p => (
                                <TableRow key={p.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                    <TableCell className="text-xs text-zinc-500">{format(new Date(p.created_at), 'dd/MM HH:mm')}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getProviderIcon(p.type_code)}
                                            <span className="text-[10px] font-bold uppercase">{p.type_code.replace('WD_', '')}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm font-bold">{p.full_name}</p>
                                        <p className="text-[10px] font-mono text-zinc-500">{p.reference_code}</p>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-red-400">
                                        -{parseFloat(p.amount).toFixed(2)} {p.currency}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="ghost" className="h-8 text-xs">Détails</Button>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={5} className="text-center py-10 text-zinc-500">Aucun paiement sortant détecté.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
