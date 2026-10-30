
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
    getCountryCardRequests,
    assignAndDeliverCard,
    getBulkOrders,
    orderBulkStock,
    getCountryOrders,
    cancelCardOrderAndRefund
} from '@/lib/actions/super-agent/logistics.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, PlusCircle, ScanLine, Layers, ShoppingCart, History, ShieldAlert, Search, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';

const bulkOrderSchema = z.object({
    quantity: z.coerce.number().min(1, "La quantité doit être d'au moins 1.").max(5000, "Maximum 5000 par lot."),
    brand: z.enum(['visa', 'mastercard'], { required_error: "Veuillez choisir la marque." }),
});

const cancelOrderSchema = z.object({
    reason: z.string().min(10, "Veuillez donner une raison d'au moins 10 caractères."),
});

export default function SuperAgentCards() {
    const [requests, setRequests] = useState<any[]>([]);
    const [localBulkRequests, setLocalBulkRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isOrdering, setIsOrdering] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [requestToCancel, setRequestToCancel] = useState<any | null>(null);
    const [cardTokenInput, setCardTokenInput] = useState('');
    const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [superAgent, setSuperAgent] = useState<any>(null);

    const { openAlert } = useAlertDialog();

    const bulkForm = useForm<z.infer<typeof bulkOrderSchema>>({
        resolver: zodResolver(bulkOrderSchema),
        defaultValues: { quantity: 100, brand: 'visa' },
    });

    const cancelForm = useForm<z.infer<typeof cancelOrderSchema>>({
        resolver: zodResolver(cancelOrderSchema),
        defaultValues: { reason: '' },
    });

    const fetchData = async () => {
        setIsLoading(true);
        const current = await getAuthenticatedUser();
        setSuperAgent(current);
        if (current?.country) {
            const [reqs, bulks] = await Promise.all([
                getCountryCardRequests(current.country),
                getBulkOrders()
            ]);
            setRequests(reqs);
            if (bulks.success) {
                setLocalBulkRequests(bulks.localRequests || []);
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData().catch(() => { setIsLoading(false); openAlert({ title: 'Chargement impossible', description: 'Données indisponibles. Actualisez la page pour réessayer.', variant: 'error' }); });
    }, []);

    const filteredRequests = useMemo(() => {
        if (!searchTerm) return requests;
        return requests.filter(r =>
            r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.id_wallet.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [requests, searchTerm]);

    const handleOpenAssign = (request: any) => {
        setSelectedRequest(request);
        setCardTokenInput('');
    };

    const handleConfirmAssign = async () => {
        if (!selectedRequest || !cardTokenInput) return;

        setIsAssigning(true);
        const result = await assignAndDeliverCard(selectedRequest.id, cardTokenInput);
        setIsAssigning(false);

        if (result.success) {
            openAlert({
                title: 'Carte Assignée',
                description: `La carte physique a été activée et liée au client ${selectedRequest.full_name}.`,
                variant: 'success'
            });
            setSelectedRequest(null);
            fetchData();
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    const handleCancelOrder = async (values: z.infer<typeof cancelOrderSchema>) => {
        if (!requestToCancel || !superAgent) return;

        setIsCancelling(true);
        const result = await cancelCardOrderAndRefund(requestToCancel.id, superAgent.id, values.reason);
        setIsCancelling(false);

        if (result.success) {
            openAlert({
                title: 'Commande Annulée',
                description: `La commande a été annulée et le client remboursé.`,
                variant: 'success'
            });
            setRequestToCancel(null);
            cancelForm.reset();
            fetchData();
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    const handleOrderBulk = async (values: z.infer<typeof bulkOrderSchema>) => {
        setIsOrdering(true);
        const result = await orderBulkStock(values.quantity, values.brand);
        setIsOrdering(false);

        if (result.success) {
            openAlert({
                title: "Demande Envoyée",
                description: `Votre demande pour ${values.quantity} cartes ${values.brand.toUpperCase()} a été transmise au backoffice.`,
                variant: 'success'
            });
            setIsBulkDialogOpen(false);
            fetchData();
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Logistique & Inventaire Cartes</h1>
                <Button onClick={() => setIsBulkDialogOpen(true)} variant="gradient">
                    <PlusCircle className="h-4 w-4 mr-2"/> Nouveau Stock (Bulk)
                </Button>
            </div>

            {/* Dialog Annuler Commande */}
            <Dialog open={!!requestToCancel} onOpenChange={(open) => !open && setRequestToCancel(null)}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Annuler la Commande & Rembourser</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Le client sera immédiatement remboursé des frais d'émission sur son portefeuille {requestToCancel?.currency}.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...cancelForm}>
                        <form onSubmit={cancelForm.handleSubmit(handleCancelOrder)} className="space-y-4 py-4">
                            <FormField control={cancelForm.control} name="reason" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Raison de l'indisponibilité (Sera envoyée au client)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Ex: Rupture de stock momentanée sur la marque Visa..."
                                            className="bg-zinc-800 border-zinc-700 text-white"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setRequestToCancel(null)}>Retour</Button>
                                <Button type="submit" variant="destructive" disabled={isCancelling}>
                                    {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Confirmer l'Annulation
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Dialog Assigner Carte */}
            <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                    <DialogHeader>
                        <DialogTitle>Assigner une Carte Physique</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Saisissez l'identifiant technique (token) de la carte plastique que vous allez remettre à <strong>{selectedRequest?.full_name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Identifiant de la carte (Token/ID Marqeta)</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Ex: card_123456789"
                                    value={cardTokenInput}
                                    onChange={(e) => setCardTokenInput(e.target.value)}
                                    className="bg-zinc-800 border-zinc-700 text-white"
                                />
                                <Button variant="secondary" size="icon"><ScanLine className="h-4 w-4"/></Button>
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
                            <p className="text-xs text-primary font-bold uppercase">Résumé de la commande</p>
                            <p className="text-sm">Client: {selectedRequest?.full_name}</p>
                            <p className="text-sm">Type: {selectedRequest?.brand?.toUpperCase()} {selectedRequest?.currency}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSelectedRequest(null)}>Annuler</Button>
                        <Button onClick={handleConfirmAssign} disabled={isAssigning || !cardTokenInput}>
                            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Confirmer & Activer la carte
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Tabs defaultValue="requests" className="w-full">
                <TabsList className="bg-zinc-800 border-zinc-700">
                    <TabsTrigger value="requests"><ShoppingCart className="h-4 w-4 mr-2"/> Commandes Clients</TabsTrigger>
                    <TabsTrigger value="inventory"><Layers className="h-4 w-4 mr-2"/> Inventaire (Bulk)</TabsTrigger>
                </TabsList>

                <TabsContent value="requests" className="mt-4">
                    <Card className="bg-zinc-800 border-zinc-700 text-white">
                        <CardHeader>
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <CardTitle>Suivi des commandes nationales</CardTitle>
                                    <CardDescription className="text-zinc-400">Gérez la production et la livraison des cartes pour vos utilisateurs locaux.</CardDescription>
                                </div>
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                    <Input
                                        placeholder="Nom ou Wallet ID..."
                                        className="pl-9 bg-zinc-900 border-zinc-700"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-700 hover:bg-transparent">
                                        <TableHead className="text-zinc-400">Date</TableHead>
                                        <TableHead className="text-zinc-400">Client</TableHead>
                                        <TableHead className="text-zinc-400">Type / Devise</TableHead>
                                        <TableHead className="text-zinc-400">Statut</TableHead>
                                        <TableHead className="text-right text-zinc-400">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                                    ) : filteredRequests.length > 0 ? filteredRequests.map(req => (
                                        <TableRow key={req.id} className="border-zinc-700 hover:bg-zinc-700/30">
                                            <TableCell className="text-xs text-zinc-400">{format(new Date(req.created_at), 'dd MMM yyyy', { locale: fr })}</TableCell>
                                            <TableCell>
                                                <p className="font-bold text-sm">{req.full_name}</p>
                                                <p className="text-[10px] text-zinc-400">{req.id_wallet} • {req.phone}</p>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="mr-2 uppercase border-zinc-600 text-zinc-300">{req.brand}</Badge>
                                                <span className="text-xs font-bold text-primary">{req.currency}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    req.status === 'completed' ? 'bg-green-500' :
                                                    req.status === 'cancelled' ? 'bg-red-500' :
                                                    req.status === 'ready_for_pickup' ? 'bg-blue-500' : 'bg-zinc-600'
                                                )}>
                                                    {req.status === 'pending' ? 'À préparer' : req.status === 'cancelled' ? 'Annulée' : req.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {req.status === 'pending' && (
                                                        <>
                                                            <Button size="sm" variant="outline" className="h-8" onClick={() => handleOpenAssign(req)}>
                                                                <PlusCircle className="h-4 w-4 mr-1"/> Assigner
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="h-8 text-red-400 hover:bg-red-400/10" onClick={() => setRequestToCancel(req)}>
                                                                <XCircle className="h-4 w-4"/>
                                                            </Button>
                                                        </>
                                                    )}
                                                    {req.status === 'completed' && (
                                                        <div className="flex items-center text-green-500 text-xs font-bold gap-1 pr-2">
                                                            <CheckCircle className="h-4 w-4"/> Livrée
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={5} className="text-center py-10 text-zinc-500">Aucune commande de carte trouvée.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="inventory" className="mt-4">
                    <Card className="bg-zinc-800 border-zinc-700 text-white">
                        <CardHeader>
                            <CardTitle>Demandes et Lots de Stock</CardTitle>
                            <CardDescription className="text-zinc-400">Suivez vos demandes de réapprovisionnement national.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-zinc-700 hover:bg-transparent">
                                        <TableHead className="text-zinc-400">Date</TableHead>
                                        <TableHead className="text-zinc-400">Marque</TableHead>
                                        <TableHead className="text-zinc-400">Quantité</TableHead>
                                        <TableHead className="text-zinc-400">Statut</TableHead>
                                        <TableHead className="text-right text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary"/></TableCell></TableRow>
                                    ) : localBulkRequests.length > 0 ? localBulkRequests.map(req => (
                                        <TableRow key={req.id} className="border-zinc-700">
                                            <TableCell className="text-xs">{format(new Date(req.created_at), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="font-bold uppercase">{req.brand}</TableCell>
                                            <TableCell>{req.quantity}</TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    req.status === 'pending_approval' ? 'bg-amber-600' :
                                                    req.status === 'approved' ? 'bg-blue-600' : 'bg-green-600'
                                                )}>
                                                    {req.status === 'pending_approval' ? 'En attente backoffice' :
                                                     req.status === 'approved' ? 'Validé (En production)' : 'Commandé'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {req.status === 'pending_approval' && (
                                                    <div className="flex items-center justify-end text-amber-500 gap-1 text-[10px]">
                                                        <ShieldAlert className="h-3 w-3"/> Consultation comptable
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={5} className="text-center py-10 text-zinc-500">Aucune demande de stock en cours.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
