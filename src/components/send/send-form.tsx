

'use client';

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { User, Currency } from "@/lib/types";
import { createTransaction } from '@/lib/actions/transaction.actions';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { Loader2, ArrowLeft, Send, CheckCircle, UserCheck, ShieldAlert } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { getWalletInfo, calculateTransactionFee, type WalletInfo } from '@/lib/actions/wallet.actions';
import { Separator } from '../ui/separator';
import { InternationalWalletInput } from '@/components/shared/international-wallet-input';
import { Form, FormControl, FormField, FormLabel, FormMessage, FormItem } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { useTranslation } from "react-i18next";

type Step = 'details' | 'confirm_pin';

interface SendDetails {
    amountToSend: number;
    currency: string;
    fee: number;
    totalDebit: number;
}

const detailsSchema = z.object({
  recipientWalletId: z.string().regex(/^[A-Z]{2}\d{10}$/, { message: "Format d'ID invalide." }),
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Le montant doit être un nombre positif." }),
  paymentCurrency: z.string({ required_error: "Veuillez sélectionner un portefeuille." }),
});

const pinSchema = z.object({
  pin: z.string().min(4, "Le PIN doit contenir 4 chiffres."),
});

export function SendForm({ user, currencies, onBack }: { user: User; currencies: Currency[], onBack: () => void; }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  
  const [step, setStep] = useState<Step>('details');
  const [sendDetails, setSendDetails] = useState<SendDetails | null>(null);
  const [verifiedRecipient, setVerifiedRecipient] = useState<WalletInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fee, setFee] = useState(0);
  const [insufficientBalance, setInsufficientBalance] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof detailsSchema>>({
    resolver: zodResolver(detailsSchema),
    mode: 'onChange',
    defaultValues: {
      paymentCurrency: 'USD',
    },
  });

  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: '' },
  });

  const watchedAmount = form.watch('amount');
  const watchedPaymentCurrency = form.watch('paymentCurrency');
  const amountNum = parseFloat(watchedAmount);

  useEffect(() => {
      const calculateFeeAndBalance = async () => {
          if (amountNum > 0 && watchedPaymentCurrency && user.country) {
              const countryCode = user.country; // Use sender's country for fee calculation
              const calculatedFee = await calculateTransactionFee(amountNum, watchedPaymentCurrency, 'TR', countryCode);
              setFee(calculatedFee);

              const balance = parseFloat(String(currencies.find(c => c.code === watchedPaymentCurrency)?.balance || '0').replace(/,/g, ''));
              if (balance < (amountNum + calculatedFee)) {
                  setInsufficientBalance(`Solde insuffisant. Requis: ${(amountNum + calculatedFee).toFixed(2)} ${watchedPaymentCurrency}, disponible: ${balance.toFixed(2)} ${watchedPaymentCurrency}`);
              } else {
                  setInsufficientBalance(null);
              }
          } else {
              setFee(0);
              setInsufficientBalance(null);
          }
      }
      calculateFeeAndBalance();
  }, [watchedAmount, watchedPaymentCurrency, user.country, currencies, amountNum]);

  const handleDetailsSubmit = async (values: z.infer<typeof detailsSchema>) => {
    if (!verifiedRecipient?.success) {
      openAlert({ variant: 'error', title: 'Destinataire invalide', description: 'Veuillez vérifier que l\'ID du portefeuille est correct et validé.' });
      return;
    }
    if (insufficientBalance) {
      openAlert({ title: "Solde insuffisant", description: insufficientBalance, variant: "error" });
      return;
    }

    const amountNum = parseFloat(values.amount);

    setSendDetails({
      amountToSend: amountNum,
      currency: values.paymentCurrency,
      fee: fee,
      totalDebit: amountNum + fee,
    });
    setStep('confirm_pin');
  };
  
  const handleFinalSubmit = async (pinValues: z.infer<typeof pinSchema>) => {
    if (!sendDetails || !verifiedRecipient?.success || !verifiedRecipient.userId) return;

    setIsSubmitting(true);
    
    const pinVerificationResult = await verifyCurrentUserPin(pinValues.pin);
    if (!pinVerificationResult.success) {
      openAlert({ variant: "error", title: "Code PIN Incorrect", description: pinVerificationResult.error || "Le code PIN est incorrect." });
      setIsSubmitting(false);
      pinForm.reset();
      return;
    }
    
    const result = await createTransaction({
      user: user,
      typeCode: 'TR',
      amount: sendDetails.amountToSend,
      currency: sendDetails.currency as any,
      description: `Transfert à ${verifiedRecipient.userName}`,
      receiver_id: verifiedRecipient.userId,
      metadata: { receiver_wallet_id: verifiedRecipient.walletId, receiver_name: verifiedRecipient.userName, receiver_country_code: verifiedRecipient.countryCode, fee: sendDetails.fee },
    });
    
    if (result.success) {
      openAlert({
        variant: "success", title: "Transfert Réussi",
        description: `Le transfert à ${verifiedRecipient.userName} a été effectué avec succès.`,
        onClose: () => router.push('/dashboard')
      });
      resetFlow();
    } else {
      openAlert({ variant: "error", title: "Erreur de Transfert", description: result.error });
    }
    setIsSubmitting(false);
  };

  const resetFlow = () => {
    setStep('details');
    setSendDetails(null);
    setVerifiedRecipient(null);
    form.reset({ paymentCurrency: 'USD', amount: '', recipientWalletId: '' });
    pinForm.reset();
  };
  
  const userBalance = (currencies.find(c => c.code === watchedPaymentCurrency)?.balance || '0');

  if (step === 'confirm_pin' && sendDetails) {
    const debitSymbol = currencies.find(c => c.code === sendDetails.currency)?.symbol || '$';
    return (
       <Card>
            <CardHeader>
              <Button variant="ghost" size="icon" className="absolute top-3 left-3" onClick={() => setStep('details')}>
                  <ArrowLeft className="h-5 w-5"/>
              </Button>
              <CardTitle className="text-center pt-2">Confirmer le Transfert</CardTitle>
              <CardDescription className="text-center">Vérifiez les détails et confirmez avec votre PIN.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-6 p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Destinataire</span><div className="flex items-center gap-2 font-semibold"><UserCheck className="h-4 w-4 text-green-500" />{verifiedRecipient?.userName}</div></div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Montant à envoyer</span><span className="font-semibold">{debitSymbol}{sendDetails.amountToSend.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Frais</span><span className="font-semibold">{debitSymbol}{sendDetails.fee.toFixed(2)}</span></div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between items-center text-lg font-bold"><span>Total à débiter</span><span>{debitSymbol}{sendDetails.totalDebit.toFixed(2)}</span></div>
                </div>
                 <Form {...pinForm}>
                    <form onSubmit={pinForm.handleSubmit(handleFinalSubmit)} className="space-y-6">
                       <FormField control={pinForm.control} name="pin" render={({ field }) => (<FormItem><FormLabel>Votre PIN de sécurité</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage /></FormItem>)}/>
                        <div className="flex flex-col-reverse sm:flex-row gap-4">
                            <Button type="button" variant="outline" className="w-full" onClick={() => setStep('details')}><ArrowLeft className="mr-2 h-4 w-4" />Retour</Button>
                            <Button type="submit" variant="gradient" className="w-full font-bold" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirmer et Envoyer
                        </Button>
                        </div>
                  </form>
              </Form>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Button variant="ghost" size="icon" className="absolute top-3 left-3" onClick={onBack}>
          <ArrowLeft className="h-5 w-5"/>
        </Button>
        <CardTitle className="text-center pt-2">Transfert National</CardTitle>
        <CardDescription className="text-center">Envoyez de l'argent instantanément à un autre utilisateur CashPay.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleDetailsSubmit)} className="space-y-6">
             <FormField control={form.control} name="recipientWalletId" render={({ field }) => (
                <FormItem>
                    <InternationalWalletInput field={field} onVerificationResult={setVerifiedRecipient} label="Portefeuille du destinataire" placeholder="Ex: CD0123456789" />
                </FormItem>
            )}/>
            <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant à envoyer</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <FormField control={form.control} name="paymentCurrency" render={({ field }) => (
              <FormItem>
                  <FormLabel>Payer depuis le portefeuille</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un portefeuille" /></SelectTrigger></FormControl>
                      <SelectContent>{currencies.map((currency) => (<SelectItem key={currency.code} value={currency.code}>{currency.code} ({currency.symbol}{currency.balance})</SelectItem>))}</SelectContent>
                  </Select>
                  <FormMessage />
              </FormItem>
            )}/>
            
            {insufficientBalance && (
              <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Solde insuffisant</AlertTitle>
                  <AlertDescription>{insufficientBalance}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" variant="gradient" className="w-full font-bold" disabled={!verifiedRecipient?.success || !form.formState.isValid || !!insufficientBalance}>
                Continuer
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
