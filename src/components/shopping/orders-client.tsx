
'use client';

import { useState, useMemo } from 'react';
import type { Order } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useSearchParams, useRouter } from 'next/navigation';
import { confirmOrderReception } from '@/lib/actions/shopping.actions';
import { PackageCheck, MessageCircle, Truck, ShieldCheck, Clock, CheckCircle2, Package, Loader2, Download, FileText, Music } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';


const OrderItem = ({ order, onConfirm }: { order: Order; onConfirm: (orderId: string) => Promise<void> }) => {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const [isConfirming, setIsConfirming] = useState(false);

    const handleConfirmReception = () => {
        openAlert({
            title: "Confirmer la réception ?",
            description: `Avez-vous bien reçu la commande contenant "${order.productName}" ? Cette action confirmera que le vendeur a rempli sa mission et boostera sa crédibilité.`,
            variant: "success",
            onClose: async (confirmed) => {
                if (confirmed) {
                    setIsConfirming(true);
                    await onConfirm(order.id);
                    setIsConfirming(false);
                }
            }
        });
    }

    const getStatusInfo = (status: Order['status']) => {
        switch(status) {
            case 'pending': return { text: "En attente de paiement", color: "text-orange-500", icon: Clock };
            case 'paid': return { text: "Payé - En préparation", color: "text-blue-500", icon: ShieldCheck };
            case 'shipped': return { text: "En cours de livraison", color: "text-purple-500", icon: Truck };
            case 'delivered': return { text: "Terminée (Colis reçu)", color: "text-green-500", icon: CheckCircle2 };
            case 'cancelled': return { text: "Annulée", color: "text-red-500", icon: ShieldCheck };
            default: return { text: status, color: "text-muted-foreground", icon: Clock };
        }
    }
    
    const statusInfo = getStatusInfo(order.status);
    const isDigital = order.metadata?.isDigital || false;

    return (
        <Card className="mb-4 overflow-hidden border-zinc-200">
            <CardContent className="p-0">
                <div className="bg-zinc-50 p-3 border-b flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-600">Magasin: {order.seller?.name || 'Vendeur JoJo'}</span>
                    <div className={cn("flex items-center gap-1 font-bold", statusInfo.color)}>
                        <statusInfo.icon className="h-3 w-3" />
                        {statusInfo.text}
                    </div>
                </div>
                <div className="p-3 flex gap-4">
                    <div className="relative h-24 w-24 shrink-0">
                        <Image src={order.productImage || 'https://placehold.co/120x120.png'} alt={order.productName} fill className="rounded-lg object-cover bg-zinc-100" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <p className="text-sm font-bold line-clamp-2">{order.productName}</p>
                            <p className="text-xs text-muted-foreground mt-1">Réf: {order.reference}</p>
                        </div>
                        <div className="flex justify-between items-end">
                            <p className="font-bold text-xl text-primary">${order.totalPrice.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground bg-zinc-100 px-2 py-0.5 rounded">Qté: {order.quantity}</p>
                        </div>
                    </div>
                </div>
                
                {order.status === 'delivered' && isDigital && (
                    <div className="p-3 bg-primary/5 border-t border-b border-primary/10 space-y-2">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1"><Download className="h-3 w-3"/> Contenu Digital Prêt</p>
                        <div className="flex gap-2">
                            {order.metadata?.pdfUrl && (
                                <Button size="sm" variant="outline" className="flex-1 h-9 bg-white border-primary/20 text-primary" asChild>
                                    <a href={order.metadata.pdfUrl} download>
                                        <FileText className="mr-2 h-4 w-4"/> Lire PDF
                                    </a>
                                </Button>
                            )}
                            {order.metadata?.audioUrl && (
                                <Button size="sm" variant="outline" className="flex-1 h-9 bg-white border-primary/20 text-primary" asChild>
                                    <a href={order.metadata.audioUrl} download>
                                        <Music className="mr-2 h-4 w-4"/> Audio
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                <div className="p-3 border-t flex gap-2">
                     <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link href={`/feedback?contactId=${order.seller?.id}`}>
                            <MessageCircle className="mr-2 h-4 w-4"/> Chat
                        </Link>
                    </Button>
                    {(order.status === 'shipped' || (order.status === 'paid' && !isDigital)) && (
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 font-bold" onClick={handleConfirmReception} disabled={isConfirming}>
                        {isConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PackageCheck className="mr-2 h-4 w-4"/>} 
                        Reçu !
                      </Button>
                    )}
                    {order.status === 'delivered' && (
                         <Button variant="outline" size="sm" className="flex-1 border-green-200 text-green-700 bg-green-50" disabled>
                            <CheckCircle2 className="mr-2 h-4 w-4"/> Commande Terminée
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};


export function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
    const searchParams = useSearchParams();
    const [orders, setOrders] = useState<Order[]>(initialOrders);
    const [activeTab, setActiveTab] = useState(searchParams.get('status') || 'all');

    const handleConfirm = async (orderId: string) => {
        const result = await confirmOrderReception(orderId);
        if (result.success) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o));
            setActiveTab('delivered');
        }
    };

    const filteredOrders = useMemo(() => {
        if (activeTab === 'all') return orders;
        return orders.filter(o => o.status === activeTab);
    }, [orders, activeTab]);

    const tabs: { value: Order['status'] | 'all', label: string }[] = [
        { value: 'all', label: 'Tout' },
        { value: 'paid', label: "En cours" },
        { value: 'shipped', label: 'Livraison' },
        { value: 'delivered', label: 'Terminées' },
    ];

    return (
        <div className="pb-20">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 rounded-none h-auto p-0 bg-white sticky top-0 z-10 border-b">
                    {tabs.map(tab => (
                        <TabsTrigger key={tab.value} value={tab.value} className="py-4 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent text-xs font-bold uppercase tracking-tight">
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {tabs.map(tab => (
                    <TabsContent key={tab.value} value={tab.value} className="p-3">
                        {filteredOrders.length > 0 ? (
                            filteredOrders.map(order => <OrderItem key={order.id} order={order} onConfirm={handleConfirm} />)
                        ) : (
                            <div className="text-center py-32 text-muted-foreground">
                                <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>Aucune commande à afficher ici.</p>
                            </div>
                        )}
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
