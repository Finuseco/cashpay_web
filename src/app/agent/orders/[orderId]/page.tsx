
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getOrderByIdForAgent, updateOrderStatus, checkPaymentStatus } from '@/lib/actions/order.actions';
import type { Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Package, Send, User, Phone, MapPin, Loader2, RefreshCw, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

function LoadingSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-8 w-48" />
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
}

const statusSteps = [
    { status: 'paid', label: 'Payée', icon: ShieldCheck },
    { status: 'shipped', label: 'Expédiée', icon: Send },
    { status: 'delivered', label: 'Colis reçu', icon: Package },
];

function OrderStatusTracker({ currentStatus }: { currentStatus: Order['status'] }) {
    const currentIndex = statusSteps.findIndex(step => step.status === currentStatus);
    return (
        <div className="flex items-center justify-between px-4 py-6">
            {statusSteps.map((step, index) => (
                <div key={step.status} className="flex flex-col items-center text-center relative flex-1">
                    {index < statusSteps.length - 1 && (
                        <div className={cn("absolute top-5 left-1/2 w-full h-0.5 bg-muted -z-0", index < currentIndex && "bg-primary")} />
                    )}
                    <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 bg-background",
                        index <= currentIndex ? "border-primary text-primary" : "border-muted text-muted-foreground",
                        index === currentIndex && "bg-primary text-white shadow-lg animate-pulse"
                    )}>
                        <step.icon className="w-5 h-5"/>
                    </div>
                    <p className={cn("mt-2 text-xs font-semibold", index <= currentIndex ? "text-primary" : "text-muted-foreground")}>{step.label}</p>
                </div>
            ))}
        </div>
    );
}

export default function OrderDetailPage() {
    const router = useRouter();
    const params = useParams();
    const orderId = params.orderId as string;
    const { openAlert } = useAlertDialog();

    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchOrder = useCallback(async () => {
        const agent = await getAuthenticatedUser();
        if (!agent) {
            router.push('/agent/login');
            return;
        }
        const fetchedOrder = await getOrderByIdForAgent(orderId, agent.id);
        if (fetchedOrder) {
            setOrder(fetchedOrder);
        } else {
            openAlert({ title: "Erreur", description: "Commande non trouvée ou accès non autorisé.", variant: 'error' });
        }
        setIsLoading(false);
    }, [orderId, router, openAlert]);

    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);
    
    const handleUpdateStatus = async (newStatus: 'shipped') => {
        const agent = await getAuthenticatedUser();
        if (!agent) return;

        setIsUpdating(true);
        const result = await updateOrderStatus(orderId, agent.id, newStatus);
        setIsUpdating(false);

        if (result.success) {
            openAlert({ title: "Colis Expédié", description: "Le statut a été mis à jour. Le client peut désormais confirmer la réception.", variant: 'success' });
            fetchOrder();
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    const handleCheckPayment = async () => {
        setIsUpdating(true);
        const result = await checkPaymentStatus(orderId);
        setIsUpdating(false);
        if (result.success) {
            openAlert({ title: "Statut de Paiement", description: result.status || 'Vérification lancée', variant: 'info' });
            fetchOrder();
        }
    };


    if (isLoading) return <div className="container mx-auto p-4 md:p-8"><LoadingSkeleton /></div>;
    if (!order) return <div className="p-8 text-center text-destructive">Commande non trouvée.</div>;

    const isPaid = order.metadata?.transactionStatus === 'Completed';

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.push('/agent/orders')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Gestion Commande</h1>
                    <p className="font-mono text-xs text-muted-foreground">REF: {order.reference}</p>
                </div>
                <Badge className={cn("ml-auto", !isPaid ? "bg-orange-500" : "bg-green-500")}>
                    {isPaid ? "Paiement Confirmé" : "En attente de paiement"}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Suivi Logistique</CardTitle>
                    <CardDescription>Visualisez l'état d'avancement de la livraison.</CardDescription>
                </CardHeader>
                <CardContent>
                    <OrderStatusTracker currentStatus={order.status} />
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Informations Client</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-5 w-5 text-primary"/></div>
                            <div>
                                <p className="font-semibold">{order.buyerName}</p>
                                <p className="text-xs text-muted-foreground">Client CashPay</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground"/>
                            <span className="text-sm">{order.buyerPhone}</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-1"/>
                            <div className="text-sm">
                                <p className="font-medium">{order.shippingAddress?.address}</p>
                                <p className="text-muted-foreground">{order.shippingAddress?.city}, {order.shippingAddress?.province}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Résumé Financier</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between text-muted-foreground"><span>Mode de paiement:</span><span className="font-semibold text-foreground uppercase">{order.metadata?.transactionReference?.split('-')[0] || 'CashPay'}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Référence transaction:</span><span className="font-mono text-xs">{order.metadata?.transactionReference}</span></div>
                        <Separator className="my-2" />
                        <div className="flex justify-between text-muted-foreground"><span>Sous-total:</span><span className="font-semibold text-foreground">${(order.totalPrice - (order.shippingCost || 0) - (order.vatAmount || 0)).toFixed(2)}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Livraison:</span><span className="font-semibold text-foreground">${(order.shippingCost || 0).toFixed(2)}</span></div>
                        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span>Total payé:</span><span>${order.totalPrice.toFixed(2)}</span></div>
                    </CardContent>
                </Card>
            </div>

             <Card>
                <CardHeader>
                    <CardTitle>Articles à préparer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {order.items?.map((item: any) => (
                         <div key={item.id} className="flex gap-4 items-center p-3 border rounded-lg">
                            <Image src={item.image} alt={item.name} width={64} height={64} className="rounded-md bg-muted object-cover" />
                            <div className="flex-1">
                                <p className="text-sm font-bold">{item.name}</p>
                                <p className="text-xs text-muted-foreground">Quantité: {item.quantity} • Prix Unitaire: ${item.price?.toFixed(2)}</p>
                            </div>
                            <p className="font-bold text-sm">${(item.quantity * (item.price || 0)).toFixed(2)}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>
            
            <div className="flex flex-col gap-3">
                {!isPaid && (
                    <Button variant="outline" className="w-full" onClick={handleCheckPayment} disabled={isUpdating}>
                        <RefreshCw className={cn("mr-2 h-4 w-4", isUpdating && "animate-spin")} />
                        Vérifier le paiement en attente
                    </Button>
                )}

                {order.status === 'paid' && isPaid && (
                    <Button className="w-full h-12 text-lg font-bold shadow-lg" onClick={() => handleUpdateStatus('shipped')} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 animate-spin"/> : <Send className="mr-2" />}
                        Marquer comme Expédié
                    </Button>
                )}

                {order.status === 'shipped' && (
                    <Alert>
                        <Info className="h-4 w-4 text-blue-500"/>
                        <AlertTitle>En attente du client</AlertTitle>
                        <AlertDescription>
                            Le colis a été expédié. Le statut passera à "Colis reçu" dès que le client aura confirmé la réception sur son application.
                        </AlertDescription>
                    </Alert>
                )}

                {order.status === 'delivered' && (
                    <div className="p-6 bg-green-50 border-2 border-green-200 rounded-xl text-center">
                        <Check className="h-12 w-12 text-green-600 mx-auto mb-2" />
                        <h3 className="font-bold text-green-800 text-xl">Vente Terminée avec Succès</h3>
                        <p className="text-sm text-green-700">Le client a confirmé la réception du colis. Cette transaction renforce votre crédibilité en tant que partenaire de confiance.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
