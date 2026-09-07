
'use client';

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { User, Currency, Transaction } from "@/lib/types";
import { createTransaction, getUserTransactions } from '@/lib/actions/transaction.actions';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { Loader2, ArrowLeft, UserCheck, ShieldCheck, Wallet, Check } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { getWalletInfo, calculateTransactionFee, type WalletInfo } from '@/lib/actions/wallet.actions';
import { Separator } from '@/components/ui/separator';
import { InternationalWalletInput } from '@/components/shared/international-wallet-input';
import { Form, FormControl, FormField, FormLabel, FormMessage, FormItem } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useRouter } from 'next/navigation';
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TransactionReceipt } from "@/components/transactions/transaction-receipt";
import { Label } from "@/components/ui/label";

const detailsSchema = z.object({
  recipientWalletId: z.string().regex(/^[A-Z]{2}\d{10}$/, { message: "Format d'ID invalide." }),
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Le montant doit être positif." }),
  paymentCurrency: z.string({ required_error: "Sélectionnez un portefeuille." }),
});

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

export function SendForm({ user, currencies, onBack }: { user: User; currencies: Currency[], onBack: () => void; }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  
  const [step, setStep] = useState<'details' | 'confirm_pin'>('details');
  const [verifiedRecipient, setVerifiedRecipient] = useState<WalletInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fee, setFee] = useState(0);
  const [successTransaction, setSuccessTransaction] = useState<Transaction | null>(null);

  const form = useForm<z.infer<typeof detailsSchema>>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      paymentCurrency: currencies[0]?.code || 'USD',
      amount: '',
      recipientWalletId: '',
    },
  });

  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: '' },
  });

  const watchedAmount = form.watch('amount');
  const watchedCurrency = form.watch('paymentCurrency');

  useEffect(() => {
    if (watchedAmount && parseFloat(watchedAmount) > 0) {
        calculateTransactionFee(parseFloat(watchedAmount), watchedCurrency, 'TR', user.country)
            .then(setFee);
    } else {
        setFee(0);
    }
  }, [watchedAmount, watchedCurrency, user.country]);

  const handleDetailsSubmit = async (values: z.infer<typeof detailsSchema>) => {
    if (!verifiedRecipient?.success) {
      openAlert({ 
        variant: 'error', 
        title: 'Bénéficiaire requis', 
        description: 'Veuillez valider l\'ID du portefeuille avec la loupe avant de continuer.' 
      });
      return;
    }
    setStep('confirm_pin');
  };
  
  const handleFinalSubmit = async (pinValues: z.infer<typeof pinSchema>) => {
    if (!verifiedRecipient?.userId) return;
    setIsSubmitting(true);
    
    const pinVerification = await verifyCurrentUserPin(pinValues.pin);
    if (!pinVerification.success) {
      openAlert({ variant: "error", title: "Code PIN Incorrect", description: pinVerification.error });
      setIsSubmitting(false);
      return;
    }
    
    const result = await createTransaction({
      user,
      typeCode: 'TR',
      amount: parseFloat(form.getValues('amount')),
      currency: watchedCurrency,
      description: `Transfert à ${verifiedRecipient.userName}`,
      receiver_id: verifiedRecipient.userId,
      metadata: { receiver_name: verifiedRecipient.userName },
    });
    
    setIsSubmitting(false);
    if (result.success && result.reference) {
      const latestTransactions = await getUserTransactions(user.id, 1);
      if (latestTransactions.length > 0) {
          setSuccessTransaction(latestTransactions[0]);
      } else {
          openAlert({ 
              variant: 'success', 
              title: "Envoi réussi", 
              description: "Votre transfert a été traité.",
              onClose: () => router.push('/dashboard')
          });
      }
    } else {
      openAlert({ variant: "error", title: "Erreur", description: result.error });
    }
  };

  const totalToPay = parseFloat(watchedAmount || '0') + fee;

  return (
    <>
      <Dialog open={!!successTransaction} onOpenChange={(open) => !open && router.push('/dashboard')}>
          <DialogContent className="max-w-xs p-0 border-none bg-transparent shadow-none">
              {successTransaction && <TransactionReceipt transaction={successTransaction} />}
          </DialogContent>
      </Dialog>

      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="text-center px-0">
          <Button variant="ghost" size="icon" className="absolute top-3 left-3" onClick={onBack}>
            <ArrowLeft className="h-5 w-5"/>
          </Button>
          <CardTitle className="text-2xl font-black uppercase tracking-tight">Transfert CashPay</CardTitle>
          <CardDescription>Envoyez de l'argent instantanément via ID Portefeuille.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 space-y-6">
          {step === 'details' ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleDetailsSubmit)} className="space-y-6">
                <FormField control={form.control} name="recipientWalletId" render={({ field }) => (
                    <FormItem>
                        <InternationalWalletInput 
                            field={field} 
                            onVerificationResult={setVerifiedRecipient} 
                            label="ID Portefeuille du destinataire" 
                            placeholder="Ex: CD0123456789" 
                        />
                    </FormItem>
                )}/>

                <div className="space-y-3">
                  <FormLabel>Sélectionner le portefeuille de débit</FormLabel>
                  <FormField control={form.control} name="paymentCurrency" render={({ field }) => (
                      <FormItem>
                          <FormControl>
                              <RadioGroup 
                                onValueChange={field.onChange} 
                                value={field.value} 
                                defaultValue={field.value} 
                                className="grid grid-cols-1 gap-3"
                              >
                                  {currencies.map((c) => (
                                      <div key={c.code} className="relative">
                                          <RadioGroupItem value={c.code} id={`currency-${c.code}`} className="sr-only" />
                                          <Label 
                                            htmlFor={`currency-${c.code}`}
                                            className={cn(
                                                "flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer bg-card hover:bg-muted/50",
                                                field.value === c.code ? "border-primary bg-primary/5 shadow-sm" : "border-border"
                                            )}
                                          >
                                              <div className="flex items-center gap-3">
                                                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                      {c.symbol}
                                                  </div>
                                                  <div className="text-left">
                                                      <p className="font-bold text-sm text-foreground">{c.code} Wallet</p>
                                                      <p className="text-xs text-muted-foreground">Disponible: {c.balance}</p>
                                                  </div>
                                              </div>
                                              {field.value === c.code && (
                                                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center animate-in zoom-in-50 duration-200">
                                                    <Check className="h-4 w-4 text-white"/>
                                                </div>
                                              )}
                                          </Label>
                                      </div>
                                  ))}
                              </RadioGroup>
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )}/>
                </div>

                <FormField control={form.control} name="amount" render={({ field }) => ( 
                    <FormItem>
                        <FormLabel>Montant à envoyer ({watchedCurrency})</FormLabel>
                        <FormControl><Input type="number" step="any" placeholder="0.00" {...field} className="h-14 text-2xl font-black text-center" /></FormControl>
                        <FormMessage />
                    </FormItem> 
                )} />

                <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl" disabled={!form.formState.isValid}>
                    CONTINUER
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
               <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
                  <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Destinataire</span>
                      <span className="font-bold">{verifiedRecipient?.userName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Montant</span>
                      <span className="font-bold">{watchedAmount} {watchedCurrency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frais</span>
                      <span className="font-bold">{fee.toFixed(2)} {watchedCurrency}</span>
                  </div>
                  <Separator className="bg-primary/10"/>
                  <div className="flex justify-between items-baseline font-black text-xl text-primary">
                      <span>Total à débiter</span>
                      <span>{totalToPay.toFixed(2)} {watchedCurrency}</span>
                  </div>
               </div>

               <Form {...pinForm}>
                  <form onSubmit={pinForm.handleSubmit(handleFinalSubmit)} className="space-y-6">
                      <FormField control={pinForm.control} name="pin" render={({ field }) => (
                          <FormItem>
                              <FormLabel className="text-center block font-bold uppercase tracking-widest text-xs text-muted-foreground">Entrez votre PIN CashPay</FormLabel>
                              <FormControl>
                                  <div className="flex justify-center pt-2">
                                      <InputOTP maxLength={4} {...field}>
                                          <InputOTPGroup>
                                              <InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/>
                                          </InputOTPGroup>
                                      </InputOTP>
                                  </div>
                              </FormControl>
                          </FormItem>
                      )}/>
                      <div className="flex flex-col gap-3">
                          <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl" disabled={isSubmitting}>
                              {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <ShieldCheck className="mr-2"/>} CONFIRMER LE TRANSFERT
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setStep('details')}>Retour</Button>
                      </div>
                  </form>
               </Form>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
