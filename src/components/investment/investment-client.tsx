
'use client';

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, Loader2, History, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { User, Currency } from "@/lib/types";
import { createInvestment } from "@/lib/actions/investment.actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "../ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";

const formSchema = z.object({
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  amount: z.coerce.number().min(100),
  duration: z.coerce.number(),
  acceptTerms: z.boolean().refine(val => val === true)
});

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

const currencySymbols: { [key: string]: string } = {
    USD: "$",
    EUR: "€",
    CDF: "FC",
};

export function InvestmentClient({ user, currencies }: { user: User, currencies: Currency[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  const [isClient, setIsClient] = useState(false);
  const [totalReturn, setTotalReturn] = useState<number>(0);
  const [currencySymbol, setCurrencySymbol] = useState<string>('$');
  const [insufficientBalance, setInsufficientBalance] = useState<string | null>(null);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 100,
      currency: "USD",
      acceptTerms: false,
    },
  });
  
  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "" },
  });

  const amount = form.watch("amount");
  const duration = form.watch("duration");
  const currency = form.watch("currency");

  useEffect(() => {
    if (currency && currencySymbols[currency]) {
        setCurrencySymbol(currencySymbols[currency]);
    } else if (currency) {
        const foundCurrency = currencies.find(c => c.code === currency);
        setCurrencySymbol(foundCurrency?.symbol || '$');
    }

    const numericAmount = Number(amount);
    if (numericAmount >= 100 && duration > 0) {
      const interest = numericAmount * 0.0366 * duration;
      setTotalReturn(numericAmount + interest);
    } else {
      setTotalReturn(0);
    }
  }, [amount, duration, currency, currencies]);

  useEffect(() => {
    if (!isClient) return;
    const selectedCurrencyData = currencies.find(c => c.code === currency);
    const balance = selectedCurrencyData ? parseFloat(selectedCurrencyData.balance.replace(/,/g, '')) : 0;
    const numericAmount = Number(amount);

    if(balance < numericAmount) {
        setInsufficientBalance(t('insufficientBalanceMsg', { required: numericAmount, balance, currency }));
    } else {
        setInsufficientBalance(null);
    }
  }, [amount, currency, currencies, t, isClient]);

  const handleDetailsSubmit = (values: z.infer<typeof formSchema>) => {
    if (insufficientBalance) {
        openAlert({ title: t('error'), description: insufficientBalance, variant: "error" });
        return;
    }
    setIsPinDialogOpen(true);
  };
  
  const handleFinalSubmit = async (values: z.infer<typeof pinSchema>) => {
    const details = form.getValues();
    setIsSubmitting(true);
    const result = await createInvestment({ user, ...details, pin: values.pin });
    
    if (result.success) {
      openAlert({
        variant: "success",
        title: t('investmentToastSuccessTitle'),
        description: t('investmentToastSuccessDescription'),
        onClose: () => {
          setIsPinDialogOpen(false);
          router.refresh();
        }
      });
      form.reset();
    } else {
      openAlert({ variant: "error", title: t('error'), description: result.error });
    }
    setIsSubmitting(false);
  };

  if (!isClient) return null;

  return (
    <>
      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><ShieldCheck /> {t('pinConfirmTitle')}</DialogTitle>
                <DialogDescription>{t('datPinConfirmDesc', { amount: form.getValues('amount'), currency: form.getValues('currency') })}</DialogDescription>
            </DialogHeader>
            <Form {...pinForm}>
                <form onSubmit={pinForm.handleSubmit(handleFinalSubmit)} className="space-y-6 pt-4">
                    <FormField control={pinForm.control} name="pin" render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('securityPinLabel')}</FormLabel>
                            <FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="outline">{t('cancel')}</Button></DialogClose>
                      <Button type="submit" variant="gradient" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t('confirm')}
                      </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                 <h1 className="text-3xl font-bold text-foreground">{t('datTitle')}</h1>
                 <Button asChild variant="outline">
                    <Link href="/investment/history"><History className="mr-2 h-4 w-4" /> {t('loanHistoryButton')}</Link>
                </Button>
            </div>
          <Card>
            <CardHeader>
              <CardTitle>{t('investmentFormTitle')}</CardTitle>
              <CardDescription>{t('investmentFormDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleDetailsSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>{t('datAmountLabel')}</FormLabel><FormControl><Input type="number" placeholder="100" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>{t('loanCurrencyLabel')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={t('loanCurrencyPlaceholder')} /></SelectTrigger></FormControl><SelectContent>{currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                    </div>
                  <FormField control={form.control} name="duration" render={({ field }) => ( <FormItem><FormLabel>{t('datDurationLabel')}</FormLabel><Select onValueChange={(value) => field.onChange(Number(value))} value={field.value ? String(field.value) : ""}><FormControl><SelectTrigger><SelectValue placeholder={t('datDurationPlaceholder')} /></SelectTrigger></FormControl><SelectContent>
                      <SelectItem value="6">{t('investmentDuration6Months')}</SelectItem>
                      <SelectItem value="12">{t('investmentDuration12Months')}</SelectItem>
                      <SelectItem value="24">{t('investmentDuration24Months')}</SelectItem>
                  </SelectContent></Select><FormMessage /></FormItem>)}/>
                  {totalReturn > 0 && (
                    <Card className="bg-muted/50">
                        <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">{t('datTotalReturnLabel')}</p>
                            <p className="text-2xl font-bold text-foreground">{currencySymbol}{totalReturn.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                        </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{t('datTermsAndConditionsTitle')}</CardTitle>
                      <CardDescription className="text-xs">{t('datTermsAndConditionsDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                        <p>{t('datCancellationPenalty')}</p>
                        <FormField control={form.control} name="acceptTerms" render={({ field }) => ( <FormItem className="flex items-center space-x-2 pt-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="terms"/></FormControl><div><Label htmlFor="terms" className="cursor-pointer leading-tight text-foreground">{t('datAcceptTermsLabel')}</Label><FormMessage className="mt-1" /></div></FormItem> )}/>
                    </CardContent>
                  </Card>
                  {insufficientBalance && ( <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertDescription>{insufficientBalance}</AlertDescription></Alert> )}
                  <Button type="submit" variant="gradient" className="w-full" disabled={!form.formState.isValid || !!insufficientBalance}> {t('datSubmitButton')} </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
