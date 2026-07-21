
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, QrCode, Droplets, MapPin, Loader2, Save, X, Settings, Database, Smartphone, Signal, Wrench, cn } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getFuelStations, createFuelStation, getStationAssets } from '@/lib/actions/fuel.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeSVG } from 'qrcode.react';
import type { FuelStation, User, FuelPump, FuelTank } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

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
            openAlert({ title: 'Station créée', description: 'Votre station a été ajoutée. Vous pouvez maintenant configurer vos pompes.', variant: 'success' });
            setIsCreateOpen(false);
            window.location.reload();
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
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
                            <div className="space-y-4">
                                {station.products.map(p => (
                                    <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                                        <div className="flex items-center gap-3">
                                            <Droplets className={cn("h-5 w-5", p.name === 'Essence' ? "text-orange-500" : "text-zinc-500")} />
                                            <span className="font-bold text-sm">{p.name}</span>
                                        </div>
                                        <p className="text-base font-black">{p.pricePerLiter} <span className="text-[10px] opacity-50">{station.baseCurrency}/L</span></p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        <CardFooter className="bg-zinc-50 border-t flex gap-2 p-3">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewStation(station)}>
                                <Wrench className="mr-2 h-4 w-4"/> Configurer </Button>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="flex-1"><QrCode className="mr-2 h-4 w-4"/> QR Code</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-xs text-center">
                                    <DialogHeader><DialogTitle>QR Code Pompe</DialogTitle><DialogDescription>{station.name}</DialogDescription></DialogHeader>
                                    <div className="p-6 bg-white rounded-2xl border-4 border-primary inline-block mx-auto my-4">
                                        <QRCodeSVG value={JSON.stringify({ type: 'FUEL_STATION', id: station.id })} size={180} />
                                    </div>
                                    <Button className="w-full">Imprimer pour la Pompe</Button>
                                </DialogContent>
                            </Dialog>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {/* Panel de gestion détaillée d'une station */}
            {selectedStation && (
                <div className="pt-8 space-y-6 animate-in slide-in-from-bottom-4">
                    <Separator />
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold flex items-center gap-2"><Smartphone className="text-primary"/> Console Hardware : {selectedStation.name}</h2>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedStation(null)}><X className="mr-2 h-4 w-4"/> Fermer</Button>
                    </div>

                    <Tabs defaultValue="pumps">
                        <TabsList className="bg-muted w-full justify-start h-12 p-1">
                            <TabsTrigger value="pumps" className="px-6"><Smartphone className="mr-2 h-4 w-4"/> Pompes Connectées</TabsTrigger>
                            <TabsTrigger value="tanks" className="px-6"><Database className="mr-2 h-4 w-4"/> Niveaux Cuves (IoT)</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="pumps" className="pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {assets.pumps.map(pump => (
                                    <Card key={pump.id} className="bg-zinc-900 text-white border-none shadow-xl">
                                        <CardContent className="p-4 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <Badge className={cn(pump.status === 'idle' ? "bg-green-500" : "bg-orange-500")}>{pump.status.toUpperCase()}</Badge>
                                                <Signal className="h-4 w-4 text-green-500" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs text-zinc-500 uppercase font-bold">Numéro Pompe</p>
                                                <p className="text-4xl font-black">{pump.pumpNumber}</p>
                                            </div>
                                            <Button variant="outline" size="sm" className="w-full bg-white/5 border-white/10 hover:bg-white/10">Historique local</Button>
                                        </CardContent>
                                    </Card>
                                ))}
                                <Button variant="outline" className="h-full border-dashed border-2 min-h-[140px] flex-col gap-2">
                                    <PlusCircle className="h-8 w-8 text-zinc-300" />
                                    <span className="text-xs font-bold text-zinc-500">Ajouter une pompe</span>
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="tanks" className="pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {assets.tanks.map(tank => (
                                    <Card key={tank.id}>
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between">
                                                <CardTitle className="text-sm font-bold uppercase">{tank.productId} - Cuve principale</CardTitle>
                                                <p className="text-xs text-muted-foreground">Capacité: {tank.capacity}L</p>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex items-end justify-between">
                                                <p className="text-3xl font-black">{tank.currentVolume.toLocaleString()} <span className="text-sm font-normal">Litres</span></p>
                                                <p className="text-xs font-bold text-green-600">{Math.round((tank.currentVolume/tank.capacity)*100)}%</p>
                                            </div>
                                            <Progress value={(tank.currentVolume/tank.capacity)*100} className="h-3" />
                                            <p className="text-[10px] text-muted-foreground italic flex items-center gap-1"><Signal className="h-3 w-3"/> Dernière lecture capteur : Aujourd'hui à 14:32</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            )}

            {/* Dialog Création Station */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Enregistrer une Station-Service</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2"><Label>Nom commercial</Label><Input placeholder="Ex: TOTAL GOMBE 1" value={newStation.name} onChange={e => setNewStation({...newStation, name: e.target.value})}/></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Province</Label><Input value={newStation.province} onChange={e => setNewStation({...newStation, province: e.target.value})}/></div>
                            <div className="space-y-2">
                                <Label>Devise Recettes</Label>
                                <Select value={newStation.baseCurrency} onValueChange={v => setNewStation({...newStation, baseCurrency: v})}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CDF">Franc Congolais (CDF)</SelectItem>
                                        <SelectItem value="USD">Dollar (USD)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-4">
                            <Label className="text-xs font-bold uppercase text-primary">Tarifs par défaut (Devise Locale)</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase">Essence / L</p><Input type="number" value={newStation.priceEssence} onChange={e => setNewStation({...newStation, priceEssence: Number(e.target.value)})}/></div>
                                <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase">Gasoil / L</p><Input type="number" value={newStation.priceGasoil} onChange={e => setNewStation({...newStation, priceGasoil: Number(e.target.value)})}/></div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleCreate} className="w-full" variant="gradient">Valider la Création</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
