

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User } from '@/lib/types';
import type { Event, TicketType } from '@/lib/actions/types';
import { purchaseTicket } from '@/lib/actions/event.actions';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Minus, Plus } from 'lucide-react';

interface PurchaseTicketButtonProps {
    event: Event;
    ticketType: TicketType;
    user: User | null;
}

export function PurchaseTicketButton({ event, ticketType, user }: PurchaseTicketButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const { openAlert } = useAlertDialog();
    const router = useRouter();

    const handlePurchase = async () => {
        if (!user) {
            router.push('/login');
            return;
        }
        
        if (quantity <= 0) {
            openAlert({ title: 'Quantité invalide', description: 'Veuillez sélectionner au moins un billet.', variant: 'warning' });
            return;
        }

        setIsLoading(true);
        const result = await purchaseTicket(user.id, event.id, ticketType.id, quantity, event.currency);
        setIsLoading(false);

        if (result.success) {
            openAlert({
                title: 'Achat Réussi !',
                description: `Vos ${quantity} billet(s) "${ticketType.type}" pour l'événement "${event.name}" ont été achetés. Vous pouvez les retrouver dans "Mes Billets".`,
                variant: 'success'
            });
            router.refresh(); 
        } else {
            openAlert({
                title: 'Échec de l\'achat',
                description: result.error || "Une erreur inconnue est survenue.",
                variant: 'error'
            });
        }
    };
    
    const isDisabled = !user || (ticketType.quantity - ticketType.sold) < quantity || quantity <= 0;

    return (
        <div className="flex items-center gap-2">
             <div className="flex items-center border rounded-md">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
                <Input type="text" value={quantity} readOnly className="w-10 text-center border-0 focus-visible:ring-0 h-8 p-0"/>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuantity(q => Math.min(q + 1, ticketType.quantity - ticketType.sold))}><Plus className="h-4 w-4" /></Button>
            </div>
            <Button size="sm" variant="gradient" onClick={handlePurchase} disabled={isDisabled || isLoading} className="h-8">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                Acheter
            </Button>
        </div>
    );
}
