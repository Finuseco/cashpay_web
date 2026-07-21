
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Coins, Search, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCardActivityFeed } from '@/lib/actions/super-agent/logistics.actions';
import { cn, getCountryByCode, countryToCode } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface CurrencyVolume {
    visa: number;
    mastercard: number;
    total: number;
}

export default function CardActivityPage() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [stats, setStats] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [localCurrency, setLocalCurrency] = useState('Local');

    useEffect(() => {
        const fetchData = async () => {
            const current = await getAuthenticatedUser();
            if (current?.country) {
                const code = countryToCode(current.country);
                const countryInfo = getCountryByCode(code || '');
                if (countryInfo) setLocalCurrency(countryInfo.currency_code);

                const result = await getCardActivityFeed(current.country);
                setTransactions(result.transactions || []);
                setStats(result.stats || []);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const filtered = transactions.filter(t => 
        t.full_name.toLowerCase().includes(filter.toLowerCase()) ||
        t.description.toLowerCase().includes(filter.toLowerCase())
    );

    const volumesByCurrency = useMemo(() => {
        const grouped: Record<string, CurrencyVolume> = {};
        ['USD', 'EUR', localCurrency].forEach(c => {
            grouped[c] = { visa: 0, mastercard: 0, total: 0 };
        });

        stats.forEach(s => {
            if (!grouped[s.currency]) grouped[s.currency] = { visa: 0, mastercard: 0, total: 0 };
            const amount = parseFloat(s.total);
            if (s.brand === 'visa') grouped[s.currency].visa += amount;
            if (s.brand === 'mastercard') grouped[s.currency].mastercard += amount;
            grouped[s.currency].total += amount;
        });

        return grouped;
    }, [stats, localCurrency]);

    const VolumeCard = ({ currency, data }: { currency: string, data: CurrencyVolume }) => (
        <Card className="bg-zinc-800 border-zinc-700 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-5">
                <Coins className="h-20 w-20" />
            </div>
            <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                    Volume {currency} (30j)
                    <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">LIVE</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-black mb-4">
                    {data.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-sm font-normal opacity-60">{currency}</span>
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 rounded bg-zinc-900/50 border border-zinc-700/50">
                        <p className="text-zinc-500 font-bold mb-1">VISA</p>
                        <p className="font-mono text-blue-400">{data.visa.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-2 rounded bg-zinc-900/50 border border-zinc-700/50">
                        <p className="text-zinc-500 font-bold mb-1">MASTERCARD</p>
                        <p className="font-mono text-orange-400">{data.mastercard.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter">Activité Réseau Cartes</h1>
                    <p className="text-sm text-zinc-400">Surveillance temps-réel des cartes Visa et MasterCard émises dans votre pays.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input 
                        placeholder="Chercher porteur ou réf..." 
                        className="pl-9 bg-zinc-800 border-zinc-700 h-11"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <Alert className="bg-primary/5 border-primary/20 text-primary-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <AlertTitle className="font-bold">Modèle Just-In-Time (JIT)</AlertTitle>
                <AlertDescription className="text-xs opacity-80">
                    Les transactions affichées ci-dessous ont été validées en temps réel par notre moteur souverain avant d'être autorisées. Aucun fonds n'est stocké sur les cartes.
                </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <VolumeCard currency="USD" data={volumesByCurrency['USD']} />
                <VolumeCard currency="EUR" data={volumesByCurrency['EUR']} />
                <VolumeCard currency={localCurrency} data={volumesByCurrency[localCurrency]} />
            </div>

            <Card className="bg-zinc-800 border-zinc-700 text-white shadow-2xl">
                <CardHeader className="border-b border-zinc-700/50">
                    <CardTitle>Journal des Paiements interceptés</CardTitle>
                    <CardDescription className="text-zinc-500">Flux de financement JIT (Just-In-Time) synchronisés avec les portefeuilles CashPay.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700 hover:bg-transparent">
                                <TableHead className="text-zinc-400">Date</TableHead>
                                <TableHead className="text-zinc-400">Carte</TableHead>
                                <TableHead className="text-zinc-400">Porteur</TableHead>
                                <TableHead className="text-zinc-400">Marchand</TableHead>
                                <TableHead className="text-right text-zinc-400">Montant</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-8 w-8"/></TableCell></TableRow>
                            ) : filtered.length > 0 ? filtered.map(t => (
                                <TableRow key={t.id} className="border-zinc-700 hover:bg-zinc-700/30 transition-colors">
                                    <TableCell className="text-xs text-zinc-500">{format(new Date(t.created_at), 'dd/MM HH:mm')}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] uppercase border-zinc-600 px-2 py-0.5",
                                            t.brand === 'visa' ? "text-blue-400 bg-blue-400/5" : "text-orange-400 bg-orange-400/5"
                                        )}>
                                            {t.brand} •••• {t.last4}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm font-bold">{t.full_name}</p>
                                    </TableCell>
                                    <TableCell className="text-xs text-zinc-300">
                                        <span className="opacity-50">at</span> {t.description.replace('Paiement Carte: ', '')}
                                    </TableCell>
                                    <TableCell className="text-right font-black text-base">
                                        {parseFloat(t.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal opacity-50">{t.currency}</span>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={5} className="text-center py-20 text-zinc-500 italic">Aucune transaction carte détectée sur ce territoire.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
