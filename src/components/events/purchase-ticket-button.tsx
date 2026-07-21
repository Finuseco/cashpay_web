
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User, Currency } from '@/lib/types';
import type { Event, TicketType } from '@/lib/actions/types';
import { purchaseTicket } from '@/lib/actions/event.actions';
import { Loader2, Minus, Plus, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { useTranslation } from 'react-i18next';

interface PurchaseTicketButtonProps {
    event: Event;
    ticketType: TicketType;
    user: User | null;
}

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

export function PurchaseTicketButton({ event, ticketType, user }: PurchaseTicketButtonProps) {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [showPinDialog, setShowPinDialog] = useState(false);
    const [userCurrencies, setUserCurrencies] = useState<Currency[]>([]);

    const { openAlert } = useAlertDialog();
    const router = useRouter();

    useEffect(() => {
        if (user) {
            getUserCurrencies(user.id).then(setUserCurrencies);
        }
    }, [user]);

    const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema),
    });

    const hasRequiredCurrency = useMemo(() => {
        if (!user) return true; // Let the login redirect handle it
        return userCurrencies.some(c => c.code === event.currency);
    }, [user, userCurrencies, event.currency]);

    const isEventPast = useMemo(() => new Date(event.date) < new Date(), [event.date]);
    

    const handleOpenDialog = () => {
        if (!user) {
            router.push(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
            return;
        }
        setIsDialogOpen(true);
    };

    const handlePurchase = async (pinValue: string) => {
        if (!user) return;
        setIsLoading(true);

        const pinVerification = await verifyCurrentUserPin(pinValue);
        if (!pinVerification.success) {
            openAlert({ variant: "error", title: "PIN Incorrect", description: pinVerification.error || "Le code PIN est incorrect." });
            setIsLoading(false);
            pinForm.reset();
            return;
        }

        const result = await purchaseTicket(user.id, event.id, ticketType.id, quantity, event.currency);
        
        setShowPinDialog(false);
        setIsDialogOpen(false);
        setIsLoading(false);
        pinForm.reset();

        if (result.success) {
            openAlert({
                title: t('eventDetailsPurchaseSuccessTitle'),
                description: t('eventDetailsPurchaseSuccessDesc', {quantity: quantity, ticketType: ticketType.type, eventName: event.name}),
                variant: 'success'
            });
            router.refresh(); 
        } else {
            openAlert({
                title: t('eventDetailsPurchaseErrorTitle'),
                description: result.error || "Une erreur inconnue est survenue.",
                variant: 'error'
            });
        }
    };
    
    const isDisabled = !user || (ticketType.quantity - ticketType.sold) < quantity || quantity <= 0 || !hasRequiredCurrency || isEventPast;
    const totalAmount = ticketType.price * quantity;
    
    const buttonTooltip = !hasRequiredCurrency ? t('eventDetailsCurrencyError', {currency: event.currency}) : isEventPast ? "Cet événement est déjà terminé." : '';

    return (
        <>
            <div title={buttonTooltip}>
                <Button size="sm" variant="gradient" onClick={handleOpenDialog} className="h-8" disabled={isDisabled}>
                     {isEventPast ? "Événement terminé" : t('eventDetailsBuyButton')}
                </Button>
            </div>
             <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { if (!isOpen) { setIsDialogOpen(false); setShowPinDialog(false); } else { setIsDialogOpen(true); } }}>
                <DialogContent>
                   {!showPinDialog ? (
                       <>
                        <DialogHeader>
                            <DialogTitle>{t('eventDetailsConfirmPurchaseTitle')}</DialogTitle>
                            <DialogDescription>
                                {t('eventDetailsConfirmPurchaseDesc', {quantity: quantity, eventName: event.name})}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex items-center justify-between">
                                <Label>{t('eventDetailsTicketTypeLabel')}</Label>
                                <span className="font-semibold">{ticketType.type}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>{t('eventDetailsQuantityLabel')}</Label>
                                <div className="flex items-center border rounded-md">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
                                    <Input type="text" value={quantity} readOnly className="w-10 text-center border-0 focus-visible:ring-0 h-8 p-0"/>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuantity(q => Math.min(q + 1, ticketType.quantity - ticketType.sold))}><Plus className="h-4 w-4" /></Button>
                                </div>
                            </div>
                            <div className="flex justify-between items-baseline font-bold text-xl pt-2 border-t mt-2">
                                <Label>{t('eventDetailsTotalLabel')}</Label>
                                <span>{totalAmount.toLocaleString('fr-FR')} {event.currency}</span>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>{t('cancel')}</Button>
                            <Button onClick={() => setShowPinDialog(true)} disabled={isDisabled || isLoading}>
                                {t('confirm')}
                            </Button>
                        </DialogFooter>
                       </>
                   ) : (
                       <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><ShieldCheck/> {t('eventDetailsConfirmPinTitle')}</DialogTitle>
                            <DialogDescription>
                                {t('eventDetailsConfirmPinDesc', {total: totalAmount.toLocaleString('fr-FR'), currency: event.currency})}
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...pinForm}>
                            <form onSubmit={pinForm.handleSubmit(data => handlePurchase(data.pin))} className="space-y-6 pt-4">
                                <FormField
                                    control={pinForm.control}
                                    name="pin"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('securityPinLabel')}</FormLabel>
                                        <FormControl>
                                            <div className="flex justify-center">
                                            <InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setShowPinDialog(false)}>{t('backButton')}</Button>
                                    <Button type="submit" variant="gradient" disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {t('eventDetailsConfirmAndPay')}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                       </>
                   )}
                </DialogContent>
            </Dialog>
        </>
    );
}
