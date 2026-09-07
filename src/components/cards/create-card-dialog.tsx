
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Loader2, ToyBrick, ShieldCheck, Check } from "lucide-react";
import type { User, Card as CardType } from "@/lib/types";
import { purchaseCard } from "@/lib/actions/card.actions";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useRouter } from 'next/navigation';
import Image from "next/image";
import { Label } from '@/components/ui/label';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { cn } from '@/lib/utils';

const purchaseFormSchema = z.object({
  card_type: z.enum(["virtuelle", "physique"]),
  brand: z.enum(["visa", "mastercard"]),
  currency: z.string({ required_error: "Devise requise." }),
});

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

export function CreateCardDialog({ user, existingCards, open, onOpenChange }: { user: User, existingCards: CardType[], open: boolean, onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creationFee, setCreationFee] = useState<number>(0);
  const [isLoadingFee, setIsLoadingFee] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [cardDetails, setCardDetails] = useState<z.infer<typeof purchaseFormSchema> | null>(null);

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

  // Récupération dynamique des prix depuis la table fee_structures
  useEffect(() => {
    const fetchFee = async () => {
      setIsLoadingFee(true);
      // Construction du code de frais exact : BUY_CARDS_USD_V_FEE par exemple
      const suffix = cardType === 'virtuelle' ? 'V' : 'P';
      const feeCode = `BUY_CARDS_${currency.toUpperCase()}_${suffix}_FEE`;
      
      try {
          const fee = await calculateTransactionFee(1, currency, feeCode, user.country);
          setCreationFee(fee);
      } catch (e) {
          console.error("Failed to fetch card fee:", e);
          setCreationFee(0);
      }
      setIsLoadingFee(false);
    };
    if (open) fetchFee();
  }, [cardType, currency, user.country, open]);

  const availableCurrencies = useMemo(() => {
    const internationalCurrencies = ['USD', 'EUR'];
    const usedCurrenciesForType = existingCards
        .filter(card => card.card_type === cardType)
        .map(card => card.currency);
    return internationalCurrencies.filter(c => !usedCurrenciesForType.includes(c));
  }, [existingCards, cardType]);

  const handleInitialSubmit = (values: z.infer<typeof purchaseFormSchema>) => {
    if (availableCurrencies.length === 0) {
        openAlert({ title: 'Limite atteinte', description: "Vous possédez déjà une carte de ce type pour chaque devise.", variant: 'warning' });
        return;
    }
    setCardDetails(values);
    setShowPinDialog(true);
  };

  const handlePinConfirm = async (pinValues: z.infer<typeof pinSchema>) => {
    if (!cardDetails) return;
    setIsSubmitting(true);
    
    const pinVerification = await verifyCurrentUserPin(pinValues.pin);
    if (!pinVerification.success) {
        openAlert({ variant: "error", title: "PIN Incorrect", description: pinVerification.error });
        setIsSubmitting(false);
        pinForm.reset();
        return;
    }

    const result = await purchaseCard({
      user, ...cardDetails, pin: pinValues.pin,
    });
    
    setIsSubmitting(false);
    if (result.success) {
      openAlert({ variant: "success", title: "Commande réussie", description: "Votre carte a été générée.", onClose: () => router.refresh() });
      onOpenChange(false);
      setShowPinDialog(false);
    } else {
       openAlert({ variant: "error", title: "Erreur", description: result.error });
    }
  };

  return (
    <>
    <Dialog open={open && !showPinDialog} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
          <DialogHeader>
              <DialogTitle>Commander une Carte</DialogTitle>
              <DialogDescription>Personnalisez votre instrument de paiement souverain.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
              <form onSubmit={form.handleSubmit(handleInitialSubmit)} className="space-y-8 py-4">
                  <div className="space-y-4">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Format de la carte</Label>
                      <FormField control={form.control} name="card_type" render={({ field }) => (
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-3">
                              <div className="relative">
                                  <RadioGroupItem value="virtuelle" id="v-virt" className="sr-only peer" />
                                  <Label htmlFor="v-virt" className={cn("flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5")}>
                                      <CreditCard className="mb-2 h-6 w-6" />
                                      <span className="font-bold text-sm">Digitale</span>
                                  </Label>
                              </div>
                              <div className="relative">
                                  <RadioGroupItem value="physique" id="v-phys" className="sr-only peer" />
                                  <Label htmlFor="v-phys" className={cn("flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5")}>
                                      <ToyBrick className="mb-2 h-6 w-6" />
                                      <span className="font-bold text-sm">Plastique</span>
                                  </Label>
                              </div>
                          </RadioGroup>
                      )} />
                  </div>

                  <div className="space-y-4">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Réseau partenaire</Label>
                      <FormField control={form.control} name="brand" render={({ field }) => (
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-3">
                              <div className="relative">
                                  <RadioGroupItem value="visa" id="b-visa" className="sr-only peer" />
                                  <Label htmlFor="b-visa" className={cn("flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 h-16")}>
                                      <Image src="/logos/visa.png" alt="Visa" width={60} height={20} className="object-contain" />
                                  </Label>
                              </div>
                              <div className="relative">
                                  <RadioGroupItem value="mastercard" id="b-mc" className="sr-only peer" />
                                  <Label htmlFor="b-mc" className={cn("flex flex-col items-center justify-center p-4 border-2 rounded-2xl cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 h-16")}>
                                      <Image src="/logos/mc.png" alt="MC" width={40} height={24} className="object-contain" />
                                  </Label>
                              </div>
                          </RadioGroup>
                      )} />
                  </div>

                  <div className="space-y-4">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Devise du compte</Label>
                      <FormField control={form.control} name="currency" render={({ field }) => (
                          <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-3">
                              {['USD', 'EUR'].map(c => (
                                  <div key={c} className="relative">
                                      <RadioGroupItem value={c} id={`c-${c}`} className="sr-only" disabled={!availableCurrencies.includes(c)} />
                                      <Label htmlFor={`c-${c}`} className={cn(
                                          "flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer h-12 font-black transition-all",
                                          field.value === c ? "border-primary bg-primary/5 text-primary" : "border-zinc-100 text-zinc-300",
                                          !availableCurrencies.includes(c) && "opacity-20 cursor-not-allowed"
                                      )}>
                                          {c}
                                      </Label>
                                  </div>
                              ))}
                          </RadioGroup>
                      )} />
                  </div>

                  <div className="p-4 bg-muted/50 rounded-2xl border border-dashed text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Frais d'émission souverains</p>
                      {isLoadingFee ? <Loader2 className="animate-spin mx-auto h-6 w-6 mt-1" /> : (
                          <p className="text-2xl font-black text-primary mt-1">{creationFee.toFixed(2)} {currency}</p>
                      )}
                  </div>

                  <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-lg" disabled={isLoadingFee || availableCurrencies.length === 0}>
                    CONTINUER LA COMMANDE
                  </Button>
              </form>
          </Form>
      </DialogContent>
    </Dialog>

    <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="max-w-xs p-6 bg-zinc-900 border-zinc-800 text-white rounded-[2rem]">
            <DialogHeader className="text-center">
                <div className="h-12 w-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-2"><ShieldCheck className="text-primary"/></div>
                <DialogTitle>Validation PIN</DialogTitle>
                <DialogDescription className="text-zinc-400">Confirmation du débit de {creationFee.toFixed(2)} {currency}.</DialogDescription>
            </DialogHeader>
             <Form {...pinForm}>
                <form onSubmit={pinForm.handleSubmit(handlePinConfirm)} className="space-y-6 pt-4 text-center">
                    <FormField control={pinForm.control} name="pin" render={({ field }) => (
                        <FormControl>
                            <div className="flex justify-center">
                                <InputOTP maxLength={4} {...field}>
                                    <InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup>
                                </InputOTP>
                            </div>
                        </FormControl>
                    )} />
                    <Button type="submit" variant="gradient" className="w-full h-12 font-black" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "CONFIRMER L'ACHAT"}
                    </Button>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  )
}
