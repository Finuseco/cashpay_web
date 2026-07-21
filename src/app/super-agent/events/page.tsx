
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Ban, CheckCircle2, Eye, MapPin, Ticket } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCountryEvents, toggleEventStatus } from '@/lib/actions/super-agent/staff.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';

export default function SuperAgentEventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [superAgent, setSuperAgent] = useState<any>(null);
    const [filter, setFilter] = useState('');
    const [processingId, setProcessingId] = useState<number | null>(null);
    
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();

    const fetchData = async () => {
        setIsLoading(true);
        const current = await getAuthenticatedUser();
        setSuperAgent(current);
        if (current?.country) {
            const data = await getCountryEvents(current.country);
            setEvents(data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredEvents = useMemo(() => {
        return events.filter(e => 
            e.name.toLowerCase().includes(filter.toLowerCase()) ||
            e.organizerName.toLowerCase().includes(filter.toLowerCase())
        );
    }, [events, filter]);

    const handleToggleStatus = (event: any) => {
        const isActive = event.status === 'active';
        const actionText = isActive ? 'BLOQUER' : 'ACTIVER';

        openAlert({
            title: `${actionText} l'événement ?`,
            description: `Voulez-vous vraiment ${actionText.toLowerCase()} l'événement "${event.name}" ? ${isActive ? "Les clients ne pourront plus acheter de billets." : "L'événement redeviendra visible dans le catalogue public."}`,
            variant: isActive ? "destructive" : "info",
            showCancel: true,
            onClose: async (confirmed) => {
                if (confirmed) {
                    setProcessingId(event.id);
                    const result = await toggleEventStatus(event.id, event.status, superAgent.id);
                    setProcessingId(null);

                    if (result.success) {
                        toast({ title: result.status === 'active' ? "Événement réactivé" : "Ventes bloquées", variant: "success" });
                        setEvents(prev => prev.map(e => e.id === event.id ? { ...e, status: result.status } : e));
                    } else {
                        openAlert({ title: "Erreur", description: result.error, variant: 'error' });
                    }
                }
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Ticket className="text-primary"/> Surveillance des Événements</h1>
                    <p className="text-sm text-zinc-400">Gérez les rassemblements et contrôlez la billetterie sur votre territoire.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input 
                        placeholder="Chercher événement ou auteur..." 
                        className="pl-9 bg-zinc-800 border-zinc-700"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            <Card className="bg-zinc-800 border-zinc-700 text-white">
                <CardHeader>
                    <CardTitle>Catalogue des événements Nationaux</CardTitle>
                    <CardDescription className="text-zinc-400">Liste des événements créés par les utilisateurs de <strong>{superAgent?.country}</strong>.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-zinc-700 hover:bg-transparent">
                                <TableHead className="text-zinc-400">Date / Heure</TableHead>
                                <TableHead className="text-zinc-400">Événement</TableHead>
                                <TableHead className="text-zinc-400">Organisateur</TableHead>
                                <TableHead className="text-zinc-400">Billetterie</TableHead>
                                <TableHead className="text-zinc-400">Statut</TableHead>
                                <TableHead className="text-right text-zinc-400">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-primary h-8 w-8"/></TableCell></TableRow>
                            ) : filteredEvents.length > 0 ? filteredEvents.map(event => (
                                <TableRow key={event.id} className={cn("border-zinc-700 hover:bg-zinc-700/30 transition-colors", event.status === 'blocked' && "opacity-60")}>
                                    <TableCell className="text-xs text-zinc-400">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-white">{format(new Date(event.date), 'dd MMM yyyy', { locale: fr })}</span>
                                            <span>à {event.time}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <p className="font-bold text-sm text-primary">{event.name}</p>
                                            <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase font-medium">
                                                <MapPin className="h-3 w-3" />
                                                {event.type === 'zoom' ? 'En ligne (Zoom)' : event.location}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p className="text-sm font-semibold">{event.organizerName}</p>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-bold">{event.totalSold || 0} billets</p>
                                            <Progress value={Math.min(100, (event.totalSold / (event.totalQuantity || 100)) * 100)} className="h-1 bg-zinc-900" />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "text-[9px] uppercase",
                                            event.status === 'active' ? "bg-green-500" : "bg-red-600"
                                        )}>
                                            {event.status === 'active' ? 'Ventes Ouvertes' : 'Bloqué'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-zinc-400 hover:text-white">
                                                <Link href={`/events/${event.id}`} target="_blank"><Eye className="h-4 w-4"/></Link>
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className={cn("h-8 w-8", event.status === 'active' ? "text-red-400 hover:bg-red-400/10" : "text-green-400 hover:bg-green-400/10")}
                                                onClick={() => handleToggleStatus(event)}
                                                disabled={processingId === event.id}
                                            >
                                                {processingId === event.id ? <Loader2 className="h-4 w-4 animate-spin"/> : event.status === 'active' ? <Ban className="h-4 w-4"/> : <CheckCircle2 className="h-4 w-4"/>}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={6} className="text-center py-20 text-zinc-500">Aucun événement trouvé dans votre juridiction.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
