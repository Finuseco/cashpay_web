
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, QrCode, Droplets, MapPin, Loader2, Save, X, Settings, Database, Smartphone, Signal, Wrench } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getFuelStations, createFuelStation, getStationAssets } from '@/lib/actions/fuel.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeSVG } from 'qrcode.react';
import type { FuelStation, User, FuelPump, FuelTank } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AgentFuelManagement() {
    const [stations, setStations] = useState<FuelStation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedStation, setSelectedStation] = useState<FuelStation | null>(null);
    const [assets, setAssets] = useState<{ pumps: FuelPump[], tanks: FuelTank[] }>({ pumps: [], tanks: [] });
    const [user, setUser] = useState<User | null>(null);
    const { openAlert } = useAlertDialog();
   

    const [newStation, setNewStation] = useState({
        name: '', address: '', countryCode: 'CD', province: 'Kinshasa', baseCurrency: 'CDF', priceEssence: 3500, priceGasoil: 3450
    });

    useEffect(() => {
        const fetch = async () => {
            const currentUser = await getAuthenticatedUser();
            setUser(currentUser);
            if (currentUser) {
                const data = await getFuelStations();
                setStations(data.filter(s => s.ownerUserId === currentUser.id));
            }
            setIsLoading(false);
        };
        fetch();
    }, []);

    const handleViewStation = async (station: FuelStation) => {
        setSelectedStation(station);
        const data = await getStationAssets(station.id);
        setAssets(data);
    };

    const handleCreate = async () => {
        if (!user) return;
        setIsLoading(true);
        const result = await createFuelStation(user.id, newStation);
        if (result.success) {
            openAlert({ title: 'Station créée', description: 'Votre station a été ajoutée.', variant: 'success' });
            setIsCreateOpen(false);
            window.location.reload();
        } else {
            openAlert({ title: 'Erreur', description: result.error || 'Erreur', variant: 'error' });
        }
        setIsLoading(false);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter">Gestion Station-Service</h1>
                    <p className="text-muted-foreground text-sm">Gérez vos points de vente, stocks IoT et tarifs carburant.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} variant="gradient" className="font-bold">
                    <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une Station
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stations.map(station => (
                    <Card key={station.id} className="border-none shadow-lg overflow-hidden group hover:shadow-primary/10 transition-all">
                        <CardHeader className="bg-zinc-50 border-b relative">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{station.name}</CardTitle>
                                    <CardDescription className="flex items-center gap-1 mt-1"><MapPin className="h-3 w-3"/> {station.province}, {station.countryCode}</CardDescription>
                                </div>
                                <Badge variant="outline" className="font-bold border-primary text-primary">{station.baseCurrency}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                             <p className="text-sm text-muted-foreground">Articles et stocks disponibles...</p>
                        </CardContent>
                        <CardFooter className="bg-zinc-50 border-t flex gap-2 p-3">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewStation(station)}>
                                <Wrench className="mr-2 h-4 w-4"/> Configurer </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
            
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Enregistrer une Station-Service</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2"><Label>Nom commercial</Label><Input placeholder="Ex: TOTAL GOMBE 1" value={newStation.name} onChange={e => setNewStation({...newStation, name: e.target.value})}/></div>
                    </div>
                    <DialogFooter><Button onClick={handleCreate} className="w-full" variant="gradient">Valider la Création</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
