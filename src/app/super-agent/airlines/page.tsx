
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plane, Search, Calendar, User, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCountryFlightBookings } from '@/lib/actions/flight.actions';
import { Input } from '@/components/ui/input';

export default function SuperAgentAirlinesPage() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            const current = await getAuthenticatedUser();
            if (current?.country) {
                const data = await getCountryFlightBookings(current.country);
                setBookings(data);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const filtered = bookings.filter(b => 
        b.booking_reference.toLowerCase().includes(filter.toLowerCase()) ||
        b.user_name.toLowerCase().includes(filter.toLowerCase()) ||
        b.origin_country.toLowerCase().includes(filter.toLowerCase()) ||
        b.destination_country.toLowerCase().includes(filter.toLowerCase())
    );

    const totalVolume = bookings.reduce((sum, b) => sum + parseFloat(b.total_fare), 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Plane className="text-primary rotate-45"/> Surveillance Billetterie</h1>
                    <p className="text-sm text-zinc-400">Suivi en temps réel des réservations aériennes nationales et internationales.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input 
                        placeholder="Référence ou Passager..." 
                        className="pl-9 bg-zinc-800 border-zinc-700 h-11"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-zinc-800 border-zinc-700 text-white">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-zinc-400 uppercase">Volume Total (30j)</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-3xl font-black text-primary">${totalVolume.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</p>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-800 border-zinc-700 text-white">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-zinc-400 uppercase">Billets Émis</CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-black">{bookings.length}</p></CardContent>
                </Card>
                <Card className="bg-zinc-800 border-zinc-700 text-white">
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-zinc-400 uppercase">Statut API Réseau</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="font-bold text-green-500">OPÉRATIONNEL</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardHeader>
                    <CardTitle>Journal des Réservations</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700">
                                <TableHead className="text-zinc-400">PNR</TableHead>
                                <TableHead className="text-zinc-400">Passager Principal</TableHead>
                                <TableHead className="text-zinc-400">Itinéraire</TableHead>
                                <TableHead className="text-zinc-400 text-right">Tarif</TableHead>
                                <TableHead className="text-zinc-400 text-right">Statut</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-8 w-8"/></TableCell></TableRow>
                            ) : filtered.length > 0 ? filtered.map(b => (
                                <TableRow key={b.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                    <TableCell><code className="text-primary font-bold">{b.booking_reference}</code></TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm">{b.user_name}</span>
                                            <span className="text-[10px] text-zinc-500 font-mono">{b.user_wallet}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="font-bold">{b.origin_country}</span>
                                            <ArrowRight className="h-3 w-3 text-zinc-600"/>
                                            <span className="font-bold">{b.destination_country}</span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 mt-1">Départ le {format(new Date(b.departure_date), 'dd MMM yyyy', { locale: fr })}</p>
                                    </TableCell>
                                    <TableCell className="text-right font-black">
                                        ${parseFloat(b.total_fare).toFixed(2)} {b.currency}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge className="bg-green-600 uppercase text-[9px] font-black">{b.booking_status}</Badge>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={5} className="text-center py-20 text-zinc-500 italic">Aucune réservation détectée.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
