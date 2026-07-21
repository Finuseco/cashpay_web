
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, ChevronRight } from 'lucide-react';
import type { Order, User } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getOrdersForAgent } from '@/lib/actions/order.actions';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const OrderItem = ({ order }: { order: Order }) => {
    const router = useRouter();
    const getStatusInfo = (status: Order['status']) => {
        switch(status) {
            case 'pending': return { text: "En attente de paiement", color: "text-orange-500" };
            case 'paid': return { text: "Payé - Prêt à expédier", color: "text-blue-500" };
            case 'shipped': return { text: "Expédiée", color: "text-purple-500" };
            case 'delivered': return { text: "Colis reçu", color: "text-green-500" };
            case 'cancelled': return { text: "Annulée", color: "text-red-500" };
            default: return { text: status, color: "text-muted-foreground" };
        }
    }
    const statusInfo = getStatusInfo(order.status);
    
    return (
        <Link href={`/agent/orders/${order.reference}`}>
            <Card className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                        <span className="font-mono">#{order.id}</span>
                        <span className={cn("font-semibold", statusInfo.color)}>{statusInfo.text}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {order.productImage && <img src={order.productImage} alt={order.productName} className="h-16 w-16 rounded-md object-cover bg-muted" />}
                        <div className="flex-1">
                            <p className="font-semibold">{order.productName}</p>
                            <p className="text-sm text-muted-foreground">Client: {order.buyerName || 'Non spécifié'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                           <p className="font-bold text-lg">${order.totalPrice.toFixed(2)}</p>
                           <ChevronRight className="h-5 w-5 text-muted-foreground"/>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
};

export function AgentOrdersClient() {
    const [agent, setAgent] = useState<User | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('');

    const fetchOrders = useCallback(async (agentId: number) => {
        setIsLoading(true);
        const fetchedOrders = await getOrdersForAgent(agentId);
        setOrders(fetchedOrders);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const loadAgentAndOrders = async () => {
            const currentAgent = await getAuthenticatedUser();
            setAgent(currentAgent);
            if (currentAgent) {
                fetchOrders(currentAgent.id);
            } else {
                setIsLoading(false);
            }
        };
        loadAgentAndOrders();
    }, [fetchOrders]);
    
    const filteredOrders = orders.filter(order => 
        order.id.toString().includes(filter) ||
        order.productName.toLowerCase().includes(filter.toLowerCase()) ||
        (order.buyerName && order.buyerName.toLowerCase().includes(filter.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Commandes JoJo Shopping</CardTitle>
                    <CardDescription>
                        Consultez ici les commandes passées pour les produits de vos boutiques.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="relative flex-1">
                            <Input 
                                placeholder="Rechercher par N° commande, produit, ou client..."
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="pl-10"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredOrders.length > 0 ? (
                        <div className="space-y-4">
                            {filteredOrders.map(order => <OrderItem key={order.id} order={order} />)}
                        </div>
                    ) : (
                        <div className="text-center py-16 text-muted-foreground">
                            <p>Aucune commande trouvée.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
