

'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState, useEffect, useCallback } from "react";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { Card, User, Currency } from "@/lib/types";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowDown, ShieldCheck } from "lucide-react";
import { transferBetweenCards } from "@/lib/actions/card.actions";
import { getExchangeRatesForCountry, type ExchangeRate } from "@/lib/actions/exchange.actions";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { countryToCode } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const transferSchema = z.object({
  fromCardId: z.string({ required_error: "Veuillez sélectionner une carte source." }),
  toCardId: z.string({ required_error: "Veuillez sélectionner une carte de destination." }),
  amount: z.coerce.number().min(1, "Le montant minimum est de 1."),
}).refine(data => data.fromCardId !== data.toCardId, {
    message: "Les cartes source et destination doivent être différentes.",
    path: ["toCardId"],
});

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});


export function CardTransferForm({ user, cards, currencies, onComplete }: { user: User, cards: Card[], currencies: Currency[], onComplete: () => void }) {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);
    const [rate, setRate] = useState<number | null>(null);
    const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
    const [showPinDialog, setShowPinDialog] = useState(false);
    const [transferDetails, setTransferDetails] = useState<z.infer<typeof transferSchema> | null>(null);

    const form = useForm<z.infer<typeof transferSchema>>({
        resolver: zodResolver(transferSchema),
    });
    
     const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema),
    });

    const fromCardId = form.watch('fromCardId');
    const toCardId = form.watch('toCardId');
    const amount = form.watch('amount');

    const fromCard = cards.find(c => c.id === fromCardId);
    const toCard = cards.find(c => c.id === toCardId);
    
    useEffect(() => {
        const fetchRates = async () => {
            const userCountryCode = countryToCode(user.country);
            if(userCountryCode) {
              const rates = await getExchangeRatesForCountry(userCountryCode);
              setExchangeRates(rates);
              if (rates.length === 0) {
                   openAlert({
                      title: "Taux non configurés",
                      description: "Les taux de change pour votre pays ne sont pas encore configurés. Nous collaborons avec votre gouvernement pour les établir.",
                      variant: 'warning'
                  });
              }
            }
        };
        fetchRates();
    }, [user.country, openAlert]);

    useEffect(() => {
        if (fromCard && toCard && amount > 0) {
            if (fromCard.currency === toCard.currency) {
                setRate(1);
                setCalculatedAmount(amount);
            } else {
                const exchangeRate = exchangeRates.find(r => r.from_currency === fromCard.currency && r.to_currency === toCard.currency)?.rate;
                if (exchangeRate) {
                    setRate(exchangeRate);
                    setCalculatedAmount(amount * exchangeRate);
                } else {
                    setRate(null);
                    setCalculatedAmount(null);
                }
            }
        } else {
            setCalculatedAmount(null);
            setRate(null);
        }
    }, [fromCard, toCard, amount, exchangeRates]);

    const handleInitialSubmit = (values: z.infer<typeof transferSchema>) => {
        setTransferDetails(values);
        setShowPinDialog(true);
    };

    const handleFinalSubmit = async (pinValues: z.infer<typeof pinSchema>) => {
        if (!transferDetails) return;

        setIsSubmitting(true);
        
        const pinVerification = await verifyCurrentUserPin(pinValues.pin);
        if (!pinVerification.success) {
            openAlert({ variant: "error", title: "PIN Incorrect", description: pinVerification.error });
            setIsSubmitting(false);
            pinForm.reset();
            return;
        }

        const result = await transferBetweenCards({
            user,
            fromCardId: transferDetails.fromCardId,
            toCardId: transferDetails.toCardId,
            amount: transferDetails.amount,
        });

        if (result.success) {
            openAlert({
                title: t('cardTransferSuccessTitle'),
                description: t('cardTransferSuccessDescription', { amount: transferDetails.amount.toFixed(2), currency: fromCard?.currency }),
                variant: 'success',
                onClose: () => router.refresh()
            });
            onComplete();
        } else {
            openAlert({ title: t('cardTransferErrorTitle'), description: result.error, variant: 'error' });
        }
        setIsSubmitting(false);
        setShowPinDialog(false);
    };

    return (
        <>
            <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><ShieldCheck/> {t('pinConfirmTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('pinConfirmDescription', { fee: 0, currency: ''})} {/* Simplified */}
                        </DialogDescription>
                    </DialogHeader>
                     <Form {...pinForm}>
                        <form onSubmit={pinForm.handleSubmit(handleFinalSubmit)} className="space-y-6 pt-4">
                            <FormField
                                control={pinForm.control}
                                name="pin"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('securityPinLabel')}</FormLabel>
                                    <FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="ghost">{t('cardDialogCancel')}</Button></DialogClose>
                                <Button type="submit" variant="gradient" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('confirmAndPayButton')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleInitialSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="fromCardId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('cardTransferFromLabel')}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={t('cardTransferFromPlaceholder')} /></SelectTrigger></FormControl>
                                    <SelectContent>{cards.map(c => <SelectItem key={c.id} value={c.id}>{`•••• ${c.last4} (${getCurrencyForCard(c.currency, currencies)?.balance} ${c.currency})`}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="toCardId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('cardTransferToLabel')}</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={t('cardTransferToPlaceholder')} /></SelectTrigger></FormControl>
                                    <SelectContent>{cards.map(c => <SelectItem key={c.id} value={c.id}>{`•••• ${c.last4} (${c.currency})`}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('cardTransferAmountLabel')} ({fromCard?.currency})</FormLabel>
                                <FormControl><Input type="number" placeholder="10.00" {...field} value={field.value || ''} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {calculatedAmount !== null && rate !== null && toCard && fromCard?.currency !== toCard?.currency && (
                        <div className="flex flex-col items-center justify-center space-y-2 py-4">
                            <ArrowDown className="h-6 w-6 text-muted-foreground" />
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground">{t('cardTransferRateLabel')}: 1 {fromCard?.currency} ≈ {rate.toFixed(4)} {toCard.currency}</p>
                                <p className="text-sm text-muted-foreground mt-2">{t('cardTransferRecipientReceives')}</p>
                                <p className="text-2xl font-bold">{toCard.currency} {calculatedAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    )}
                    
                    <Button type="submit" variant="gradient" className="w-full">
                        {t('cardTransferContinueButton')}
                    </Button>
                </form>
            </Form>
        </>
    );
}

function getCurrencyForCard(cardCurrency: string, currencies: Currency[]) {
    return currencies.find(c => c.code === cardCurrency);
}
