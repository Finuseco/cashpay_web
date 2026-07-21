

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Loader2, ToyBrick, ShieldCheck } from "lucide-react";
import type { User, Card as CardType } from "@/lib/types";
import { purchaseCard } from "@/lib/actions/card.actions";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { Label } from '@/components/ui/label';
import { getFeeStructuresForCountry } from '@/lib/actions/fees.actions';
import { Skeleton } from '../ui/skeleton';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { countryToCode } from '@/lib/utils';


const purchaseFormSchema = z.object({
  card_type: z.enum(["virtuelle", "physique"]),
  brand: z.enum(["visa", "mastercard"]),
  currency: z.string({ required_error: "Veuillez sélectionner une devise pour la carte." }),
});

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

export function CreateCardDialog({ user, existingCards, open, onOpenChange }: { user: User, existingCards: CardType[], open: boolean, onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fees, setFees] = useState<any>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [cardDetails, setCardDetails] = useState<z.infer<typeof purchaseFormSchema> | null>(null);

  useEffect(() => {
    const userCountryCode = user.country ? countryToCode(user.country) : null;
    if (userCountryCode) {
      getFeeStructuresForCountry(userCountryCode).then(setFees);
    }
  }, [user.country]);

  const form = useForm<z.infer<typeof purchaseFormSchema>>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      card_type: "virtuelle",
      brand: "visa",
      currency: "USD",
    },
  });

  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
  });

  const cardType = form.watch('card_type');
  const currency = form.watch('currency');

  const fee = useMemo(() => {
    if (!fees || !currency) return '5.00'; // Default fee if not found
    const feeType = cardType === 'virtuelle' ? 'CD_CREATION_V' : 'CD_CREATION_P';
    const feeStructure = fees[feeType]?.find((f: any) => f.currency === currency);
    return feeStructure?.fee_tiers[0]?.fee || '5.00'; // Default fee
  }, [fees, cardType, currency]);
  
  const availableCurrencies = useMemo(() => {
    const internationalCurrencies = ['USD', 'EUR'];
    const usedCurrenciesForType = existingCards
        .filter(card => card.card_type === cardType)
        .map(card => card.currency);
    
    return internationalCurrencies.filter(currency => !usedCurrenciesForType.includes(currency));
  }, [existingCards, cardType]);
  
  useEffect(() => {
    // Reset currency if it's not available for the selected card type
    if (currency && !availableCurrencies.includes(currency)) {
        form.setValue('currency', availableCurrencies.length > 0 ? availableCurrencies[0] : '');
    }
  }, [cardType, currency, availableCurrencies, form]);


  function handleInitialSubmit(values: z.infer<typeof purchaseFormSchema>) {
    if (availableCurrencies.length === 0) {
        openAlert({variant: 'info', title: 'Limite Atteinte', description: `Vous avez déjà une carte ${values.card_type} pour chaque devise disponible.`});
        return;
    }
    setCardDetails(values);
    setShowPinDialog(true);
  }

  async function handlePinConfirm(pinValues: z.infer<typeof pinSchema>) {
    if (!cardDetails) return;
    
    setIsSubmitting(true);
    
    const pinVerification = await verifyCurrentUserPin(pinValues.pin);
    if (!pinVerification.success) {
        openAlert({ variant: "error", title: "PIN Incorrect", description: pinVerification.error || "Le code PIN est incorrect." });
        setIsSubmitting(false);
        pinForm.reset();
        return;
    }

    const result = await purchaseCard({
      user,
      card_type: cardDetails.card_type,
      brand: cardDetails.brand,
      currency: cardDetails.currency,
      pin: pinValues.pin,
    });
    
    setIsSubmitting(false);
    
    if (result.success) {
      openAlert({
        variant: "success",
        title: t('cardCreateSuccessTitle'),
        description: t('cardCreateSuccessDescription', { brand: cardDetails.brand, type: cardDetails.card_type, currency: cardDetails.currency }),
        onClose: () => router.refresh(),
      });
      onOpenChange(false);
      setShowPinDialog(false);
      form.reset();
      pinForm.reset();
    } else {
       openAlert({
        variant: "error",
        title: t('cardCreateFailedTitle'),
        description: result.error || t('cardCreateFailedDescription'),
      });
    }
  }

  return (
    <>
    <Dialog open={open && !showPinDialog} onOpenChange={onOpenChange}>
      <DialogContent>
          <DialogHeader>
              <DialogTitle>{t('cardDialogOrderTitle')}</DialogTitle>
              <DialogDescription>
                {t('cardDialogOrderDescription')}
              </DialogDescription>
          </DialogHeader>
          <Form {...form}>
              <form onSubmit={form.handleSubmit(handleInitialSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="card_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('cardDialogTypeLabel')}</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                             <FormItem className="flex-1"><FormControl><RadioGroupItem value="virtuelle" id="virtuelle" className="sr-only peer" /></FormControl><Label htmlFor="virtuelle" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"><CreditCard className="mb-3 h-6 w-6" />{t('cardDialogTypeVirtual')}</Label></FormItem>
                             <FormItem className="flex-1"><FormControl><RadioGroupItem value="physique" id="physique" className="sr-only peer" /></FormControl><Label htmlFor="physique" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"><ToyBrick className="mb-3 h-6 w-6" />{t('cardDialogTypePhysical')}</Label></FormItem>
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('cardDialogBrandLabel')}</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                             <FormItem className="flex-1"><FormControl><RadioGroupItem value="visa" id="visa" className="sr-only peer" /></FormControl><Label htmlFor="visa" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"><Image src="/logos/visa.png" alt="Visa" width={80} height={26} /></Label></FormItem>
                             <FormItem className="flex-1"><FormControl><RadioGroupItem value="mastercard" id="mastercard" className="sr-only peer" /></FormControl><Label htmlFor="mastercard" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"><Image src="/logos/mc.png" alt="Mastercard" width={60} height={36} /></Label></FormItem>
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                   <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>{t('cardDialogWalletLabel')}</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={availableCurrencies.length === 0}>
                                  <FormControl><SelectTrigger><SelectValue placeholder={availableCurrencies.length > 0 ? t('cardDialogSelectCurrency') : t('cardDialogNoWalletAvailable')} /></SelectTrigger></FormControl>
                                  <SelectContent>{availableCurrencies.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )}
                    />
                  {fee ? (
                    <p className="text-sm text-center text-muted-foreground">{t('cardCreationFee')} <span className="font-bold">{fee} {currency}</span></p>
                  ) : currency ? <Skeleton className="h-5 w-32 mx-auto" /> : null}
                  <DialogFooter>
                      <DialogClose asChild>
                          <Button type="button" variant="outline">{t('cardDialogCancel')}</Button>
                      </DialogClose>
                      <Button type="submit" variant="gradient" disabled={availableCurrencies.length === 0}>
                        {t('cardDialogConfirmOrder')}
                      </Button>
                  </DialogFooter>
              </form>
          </Form>
      </DialogContent>
    </Dialog>

    <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><ShieldCheck/> {t('pinConfirmTitle')}</DialogTitle>
                <DialogDescription>
                    {t('pinConfirmDescription', { fee: fee, currency: currency })}
                </DialogDescription>
            </DialogHeader>
             <Form {...pinForm}>
                <form onSubmit={pinForm.handleSubmit(handlePinConfirm)} className="space-y-6 pt-4">
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
    </>
  )
}
