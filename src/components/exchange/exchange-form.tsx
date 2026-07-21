
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useMemo, useCallback } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { createTransaction } from "@/lib/actions/transaction.actions";
import { getGuaranteedFxQuote, type ExchangeRate } from "@/lib/actions/exchange.actions";
import { ArrowDown, Loader2 } from "lucide-react";
import type { User, Currency } from '@/lib/types';
import { Skeleton } from "../ui/skeleton";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '../ui/dialog';
import { verifyCurrentUserPin } from "@/lib/actions/auth.actions";
import { useRouter } from 'next/navigation';
import { debounce } from "lodash";

const formSchema = z.object({
  fromCurrency: z.string({ required_error: "Please select a source currency." }),
  toCurrency: z.string({ required_error: "Please select a destination currency." }),
  fromAmount: z.coerce.number().min(0.01, { message: "Amount must be greater than 0." }),
}).refine(data => data.fromCurrency !== data.toCurrency, {
  message: "Source and destination currencies must be different.",
  path: ["toCurrency"],
});

const pinSchema = z.object({
  pin: z.string().min(4, "PIN must be 4 digits."),
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
  const [exchangeDetails, setExchangeDetails] = useState<z.infer<typeof formSchema> | null>(null);
  
  const isFormDisabled = initialRates.length === 0;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      fromAmount: undefined,
      fromCurrency: "USD",
      toCurrency: localCurrencyCode || undefined
    },
  });
  
  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "" },
  });
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const fromCurrency = form.watch("fromCurrency");
  const toCurrency = form.watch("toCurrency");
  const fromAmount = form.watch("fromAmount");

  const availableCurrencies = useMemo(() => {
      return currencies.map(c => c.code);
  }, [currencies]);

  const debouncedFetchQuote = useCallback(debounce(async (amount: number, from: string, to: string) => {
    if (amount > 0 && from && to && from !== to) {
        setIsFetchingRate(true);
        setQuote(null);
        const result = await getGuaranteedFxQuote(amount, from, to);
        if(result.success && result.quote) {
            setQuote(result.quote);
        } else {
            console.error("Failed to get quote:", result.error);
        }
        setIsFetchingRate(false);
    } else {
        setQuote(null);
    }
  }, 500), []);


  useEffect(() => {
    debouncedFetchQuote(fromAmount, fromCurrency, toCurrency);
    return () => debouncedFetchQuote.cancel();
  }, [fromAmount, fromCurrency, toCurrency, debouncedFetchQuote]);


  const handleDetailsSubmit = (values: z.infer<typeof formSchema>) => {
    const fromBalance = currencies.find(c => c.code === values.fromCurrency)?.balance || 0;
    if (values.fromAmount > fromBalance) {
      form.setError('fromAmount', { type: 'manual', message: 'Solde insuffisant pour cette opération.' });
      return;
    }
    setExchangeDetails(values);
    setIsPinDialogOpen(true);
  };
  
  const handleFinalSubmit = async (pinValues: z.infer<typeof pinSchema>) => {
    if (!user || !exchangeDetails || !quote) return;
    setIsSubmitting(true);
    
    const pinVerification = await verifyCurrentUserPin(pinValues.pin);
    if (!pinVerification.success) {
      openAlert({ variant: "error", title: t('pinLockErrorTitle'), description: pinVerification.error });
      pinForm.reset();
      setIsSubmitting(false);
      return;
    }

    const result = await createTransaction({
      user,
      typeCode: "EXCHANGE",
      amount: exchangeDetails.fromAmount,
      currency: exchangeDetails.fromCurrency,
      description: `Échange de ${exchangeDetails.fromCurrency} vers ${exchangeDetails.toCurrency}`,
      metadata: {
        toCurrency: exchangeDetails.toCurrency,
        toAmount: quote.toAmount,
        rate: quote.rate,
        quoteId: quote.quoteId, // Store the quote ID
      }
    });

    setIsSubmitting(false);
    setIsPinDialogOpen(false);

    if (result.success) {
      openAlert({
        variant: "success",
        title: t('exchangeToastSuccessTitle'),
        description: t('exchangeToastSuccessDescription', { fromAmount: exchangeDetails.fromAmount.toFixed(2), fromCurrency: exchangeDetails.fromCurrency, toAmount: quote.toAmount.toFixed(2), toCurrency: exchangeDetails.toCurrency }),
        onClose: () => router.refresh()
      });
      form.reset();
      pinForm.reset();
      setQuote(null);
    } else {
      openAlert({
        variant: "error",
        title: "Erreur",
        description: result.error,
      });
    }
  }

  const userBalance = (currencies.find(c => c.code === fromCurrency)?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!isClient) {
      return (
          <Card className="mt-8">
              <CardHeader>
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-4 w-3/4 mt-2" />
              </CardHeader>
              <CardContent>
                   <div className="space-y-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                  </div>
              </CardContent>
          </Card>
      )
  }

  return (
    <>
    <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pinConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('confirmTransferDescription')}
            </DialogDescription>
          </DialogHeader>
           <Form {...pinForm}>
              <form onSubmit={pinForm.handleSubmit(handleFinalSubmit)} className="space-y-6 pt-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p>{t('exchangeAmountLabel')} <span className="font-bold">{exchangeDetails?.fromAmount.toFixed(2)} {exchangeDetails?.fromCurrency}</span></p>
                  <p>{t('exchangeReceiveLabel')} <span className="font-bold">{quote?.toAmount.toFixed(2)} {exchangeDetails?.toCurrency}</span></p>
                </div>
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
                  <DialogClose asChild><Button type="button" variant="outline">{t('cancelButton')}</Button></DialogClose>
                  <Button type="submit" variant="gradient" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('confirmAndExchangeButton')}
                  </Button>
                </DialogFooter>
              </form>
           </Form>
        </DialogContent>
    </Dialog>
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>{t('exchangeFormTitle')}</CardTitle>
        <CardDescription>{t('exchangeFormDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleDetailsSubmit)} className="space-y-4">
          <fieldset disabled={isFormDisabled}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <FormField
                control={form.control}
                name="fromCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('exchangeFromWalletLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {availableCurrencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">Solde: {userBalance}</p>
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="toCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('exchangeToWalletLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {availableCurrencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                     <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
                control={form.control}
                name="fromAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('exchangeAmountLabel')}</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-col items-center justify-center space-y-2 py-4 h-24">
                {isFetchingRate ? (<Loader2 className="animate-spin text-muted-foreground" />) : quote ? (
                    <>
                        <ArrowDown className="h-6 w-6 text-muted-foreground" />
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">{t('exchangeReceiveLabel')}</p>
                            <p className="text-2xl font-bold">{toCurrency} {quote.toAmount.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">Taux: 1 {fromCurrency} ≈ {quote.rate.toFixed(4)} {toCurrency}</p>
                        </div>
                    </>
                ) : null}
              </div>
            <Button type="submit" variant="gradient" className="w-full" disabled={isFormDisabled || isFetchingRate || !quote}>
                {t('exchangeSubmitButton')}
            </Button>
            </fieldset>
          </form>
        </Form>
      </CardContent>
    </Card>
    </>
  );
}
