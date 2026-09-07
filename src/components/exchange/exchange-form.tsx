
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useMemo } from "react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { createTransaction } from "@/lib/actions/transaction.actions";
import { getGuaranteedFxQuote, type ExchangeRate } from "@/lib/actions/exchange.actions";
import { ArrowDown, Loader2, RefreshCw, ShieldCheck, Check } from "lucide-react";
import type { User, Currency } from '@/lib/types';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { verifyCurrentUserPin } from "@/lib/actions/auth.actions";
import { useRouter } from 'next/navigation';
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  fromCurrency: z.string({ required_error: "Sélectionnez une devise source." }),
  toCurrency: z.string({ required_error: "Sélectionnez une devise de destination." }),
  fromAmount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Montant positif requis."),
}).refine(data => data.fromCurrency !== data.toCurrency, {
  message: "Les devises doivent être différentes.",
  path: ["toCurrency"],
});

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

interface ExchangeFormProps {
    user: User | null;
    currencies: Currency[];
    initialRates: ExchangeRate[];
    localCurrencyCode?: string | null;
}

export function ExchangeForm({ user, currencies, initialRates, localCurrencyCode }: ExchangeFormProps) {
  const { openAlert } = useAlertDialog();
  const router = useRouter();
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [quote, setQuote] = useState<{ quoteId: string; toAmount: number; rate: number } | null>(null);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      fromAmount: '',
      fromCurrency: "USD",
      toCurrency: localCurrencyCode || "CDF"
    },
  });
  
  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "" },
  });
  
  const fromCurrency = form.watch("fromCurrency");
  const toCurrency = form.watch("toCurrency");
  const fromAmount = form.watch("fromAmount");

  const availableCurrencies = ['USD', 'EUR', localCurrencyCode || 'CDF'].filter(Boolean);

  const handleGetQuote = async () => {
    const amountNum = parseFloat(fromAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setIsFetchingRate(true);
    setQuote(null);
    try {
        const result = await getGuaranteedFxQuote(amountNum, fromCurrency, toCurrency);
        if(result.success && result.quote) {
            setQuote(result.quote);
        } else {
            openAlert({ title: "Taux indisponible", description: result.error || "Impossible de récupérer le taux actuel.", variant: 'error' });
        }
    } finally {
        setIsFetchingRate(false);
    }
  };

  const handleDetailsSubmit = () => {
    if (!quote) {
        handleGetQuote();
        return;
    }
    const balanceStr = currencies.find(c => c.code === fromCurrency)?.balance || '0';
    const balanceNum = parseFloat(balanceStr.replace(/,/g, ''));
    
    if (parseFloat(fromAmount) > balanceNum) {
      form.setError('fromAmount', { type: 'manual', message: 'Solde insuffisant dans ce portefeuille.' });
      return;
    }
    setIsPinDialogOpen(true);
  };
  
  const handleFinalSubmit = async (pinValues: z.infer<typeof pinSchema>) => {
    if (!user || !quote) return;
    setIsSubmitting(true);
    
    const pinVerification = await verifyCurrentUserPin(pinValues.pin);
    if (!pinVerification.success) {
      openAlert({ variant: "error", title: "PIN Incorrect", description: pinVerification.error });
      setIsSubmitting(false);
      pinForm.reset();
      return;
    }

    const result = await createTransaction({
      user,
      typeCode: "EXCHANGE",
      amount: parseFloat(fromAmount),
      currency: fromCurrency,
      description: `Échange de ${fromCurrency} vers ${toCurrency}`,
      metadata: {
        toCurrency: toCurrency,
        toAmount: quote.toAmount,
        rate: quote.rate,
        quoteId: quote.quoteId,
      }
    });

    setIsSubmitting(false);
    if (result.success) {
      openAlert({
        variant: "success",
        title: "Opération réussie",
        description: `L'échange a été effectué. Vos portefeuilles ont été mis à jour.`,
        onClose: () => router.refresh()
      });
      setIsPinDialogOpen(false);
      form.reset();
      pinForm.reset();
      setQuote(null);
    } else {
      openAlert({ variant: "error", title: "Erreur", description: result.error });
    }
  }

  if (!isClient) return null;

  const currentWallet = currencies.find(c => c.code === fromCurrency);

  return (
    <>
    <Card className="shadow-lg border-none bg-background">
      <CardHeader>
        <CardTitle>Bureau de Change Souverain</CardTitle>
        <CardDescription>Convertissez vos fonds instantanément aux taux officiels.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleDetailsSubmit)} className="space-y-8">
            <div className="space-y-4">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Portefeuille Source (Débit)</Label>
              <FormField control={form.control} name="fromCurrency" render={({ field }) => (
                <RadioGroup onValueChange={(val) => { field.onChange(val); setQuote(null); }} value={field.value} className="grid grid-cols-3 gap-2">
                  {availableCurrencies.map(cur => (
                    <div key={`from-${cur}`}>
                      <RadioGroupItem value={cur} id={`from-${cur}`} className="sr-only" />
                      <Label htmlFor={`from-${cur}`} className={cn("flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all", field.value === cur ? "border-primary bg-primary/5 text-primary" : "border-zinc-100 text-zinc-500")}>
                        <span className="font-black text-sm">{cur}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}/>
              {currentWallet && <p className="text-[10px] text-right text-muted-foreground font-bold uppercase">Solde : {currentWallet.balance}</p>}
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Devise de Réception</Label>
              <FormField control={form.control} name="toCurrency" render={({ field }) => (
                <RadioGroup onValueChange={(val) => { field.onChange(val); setQuote(null); }} value={field.value} className="grid grid-cols-3 gap-2">
                  {availableCurrencies.map(cur => (
                    <div key={`to-${cur}`}>
                      <RadioGroupItem value={cur} id={`to-${cur}`} className="sr-only" />
                      <Label htmlFor={`to-${cur}`} className={cn("flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all", field.value === cur ? "border-primary bg-primary/5 text-primary" : "border-zinc-100 text-zinc-500")}>
                        <span className="font-black text-sm">{cur}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}/>
            </div>

            <FormField control={form.control} name="fromAmount" render={({ field }) => (
              <FormItem>
                <FormLabel>Montant à convertir</FormLabel>
                <FormControl>
                  <Input type="number" step="any" placeholder="0.00" {...field} className="h-16 text-4xl font-black text-center border-zinc-200" onChange={(e) => { field.onChange(e); setQuote(null); }} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>
              
            <div className="flex flex-col items-center justify-center py-6 bg-zinc-50 rounded-[2rem] border-2 border-dashed border-zinc-100">
              {isFetchingRate ? (
                  <div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin text-primary" /><p className="text-[10px] font-bold uppercase">Calcul du taux...</p></div>
              ) : quote ? (
                  <div className="text-center animate-in fade-in zoom-in-95">
                      <ArrowDown className="h-5 w-5 text-zinc-300 mx-auto mb-2" />
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Vous recevrez</p>
                      <p className="text-4xl font-black text-primary">{toCurrency} {quote.toAmount.toFixed(2)}</p>
                      <p className="text-[10px] text-zinc-400 mt-2 font-bold uppercase">Taux Garanti : 1 {fromCurrency} = {quote.rate.toFixed(4)} {toCurrency}</p>
                  </div>
              ) : (
                  <Button type="button" variant="outline" onClick={handleGetQuote} className="h-12 px-8 rounded-full border-primary text-primary font-bold">
                      <RefreshCw className="mr-2 h-4 w-4"/> CALCULER LA CONVERSION
                  </Button>
              )}
            </div>

            <Button type="submit" variant="gradient" className="w-full h-16 text-xl font-black shadow-xl" disabled={isFetchingRate || !quote}>
                VALIDER L'ÉCHANGE
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>

    <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-xs p-6">
          <DialogHeader className="text-center">
            <DialogTitle>Validation PIN</DialogTitle>
            <DialogDescription className="text-zinc-400">Confirmez l'échange de {fromAmount} {fromCurrency}.</DialogDescription>
          </DialogHeader>
           <Form {...pinForm}>
              <form onSubmit={pinForm.handleSubmit(handleFinalSubmit)} className="space-y-6 pt-4">
                <FormField control={pinForm.control} name="pin" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                          <div className="flex justify-center">
                              <InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP>
                          </div>
                      </FormControl>
                    </FormItem>
                )}/>
                <Button type="submit" variant="gradient" className="w-full h-12 font-bold" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2"/>} CONFIRMER
                </Button>
              </form>
           </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}
