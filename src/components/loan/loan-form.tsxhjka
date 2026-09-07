
'use client';

import { useState, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, ShieldCheck, Check } from "lucide-react";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { createLoanApplication } from "@/lib/actions/loan.actions";
import type { User, Currency } from "@/lib/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";

const currencySymbols: Record<string, string> = { USD: '$', EUR: '€', CDF: 'FC' };
const supportedDurations = [1, 3, 6, 12, 24];

export function LoanForm({ user, currencies, interestRate = 3.66, durations = supportedDurations }: { user: User | null, currencies: Currency[], interestRate?: number, durations?: number[] }) {
  const { openAlert } = useAlertDialog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const allowedDurations = durations.length ? durations : supportedDurations;
  const formSchema = useMemo(() => z.object({
    currency: z.string({ required_error: "Devise requise." }),
    amount: z.coerce.number().positive("Montant invalide."),
    purpose: z.string({ required_error: "Motif requis." }),
    duration: z.coerce.number().refine(v => allowedDurations.includes(v), "Durée de remboursement invalide."),
  }), [allowedDurations.join(",")]);


  const loanPurposes = [
    { id: 'business', label: "Développement" },
    { id: 'education', label: "Frais Scolaires" },
    { id: 'medical', label: "Santé" },
    { id: 'personal', label: "Consommation" },
  ];
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { currency: "USD", amount: 20, duration: allowedDurations[0] || 1, purpose: 'personal' },
  });

  const watchedCurrency = form.watch("currency");
  const watchedAmount = form.watch("amount");
  const watchedDuration = form.watch("duration");

  const config = useMemo(() => {
    return { symbol: currencySymbols[watchedCurrency] || watchedCurrency };
  }, [watchedCurrency]);
  
  const selectedCurrencyData = currencies.find(c => c.code === watchedCurrency);
  const balance = selectedCurrencyData ? parseFloat(selectedCurrencyData.balance.replace(/,/g, '')) : 0;
  const requiredCollateral = (Number(watchedAmount) || 0) * 0.20;
  const collateralError = balance < requiredCollateral
    ? `Garantie insuffisante (20%). Solde requis : ${config.symbol}${requiredCollateral.toFixed(2)}`
    : null;

  const calculation = useMemo(() => {
    const interestRatePerMonth = Number(interestRate) / 100;
    const amount = Number(watchedAmount) || 0;
    const duration = Number(watchedDuration) || 1;
    const totalRepayment = amount * (1 + (interestRatePerMonth * duration));
    const monthlyPayment = totalRepayment / duration;
    return { totalRepayment, monthlyPayment };
  }, [watchedAmount, watchedDuration, interestRate]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    const result = await createLoanApplication({
        user, amount: values.amount, currency: values.currency,
        durationMonths: values.duration, purpose: values.purpose,
        interestRate
    });
    setIsSubmitting(false);

    if (result.success) {
        openAlert({ title: "Demande Transmise", description: "Votre dossier est en cours de validation par le service financier.", variant: 'success' });
        form.reset();
    } else {
        openAlert({ title: "Erreur", description: result.error || "Échec de l'envoi.", variant: 'error' });
    }
  }


  return (
    <Card className="shadow-2xl border-none bg-white rounded-3xl overflow-hidden">
      <CardHeader className="bg-zinc-50 border-b border-zinc-100">
        <CardTitle className="text-xl text-zinc-900">Calculateur de Prêt</CardTitle>
        <CardDescription>Saisissez le montant et choisissez la durée de remboursement.</CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Devise du prêt</Label>
              <FormField control={form.control} name="currency" render={({ field }) => (
                <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-3">
                  {['USD', 'EUR', 'CDF'].map(cur => (
                    <div key={cur}>
                      <RadioGroupItem value={cur} id={`lc-${cur}`} className="sr-only" />
                      <Label htmlFor={`lc-${cur}`} className={cn("flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all h-12 font-black", field.value === cur ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-zinc-100 text-zinc-400 hover:bg-zinc-50")}>
                        {cur}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}/>
            </div>

            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-xs font-bold uppercase text-zinc-500">Montant souhaité ({config.symbol})</FormLabel>
                  <FormControl>
                     <Input type="number" {...field} className="h-16 text-4xl font-black text-center border-zinc-200 focus:border-primary focus:ring-primary/20 bg-zinc-50" placeholder="0.00" />
                  </FormControl>
                  <div className="flex justify-between px-1">
                      <span className="text-[10px] font-bold text-zinc-400">GARANTIE : 20%</span>
                      <span className="text-[10px] font-bold text-zinc-400">TAUX : {Number(interestRate).toFixed(2)}% / mois</span>
                  </div>
                  <FormMessage />
                </FormItem>
            )}/>

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Durée de remboursement (Mois)</Label>
              <FormField control={form.control} name="duration" render={({ field }) => (
                <RadioGroup onValueChange={(val) => field.onChange(Number(val))} value={field.value.toString()} className="grid grid-cols-4 gap-2">
                  {allowedDurations.map(m => (
                    <div key={m}>
                      <RadioGroupItem value={m.toString()} id={`dur-${m}`} className="sr-only" />
                      <Label htmlFor={`dur-${m}`} className={cn("flex flex-col items-center justify-center border-2 rounded-xl cursor-pointer transition-all h-12", field.value === m ? "border-primary bg-primary/5 text-primary font-black" : "border-zinc-100 text-zinc-400 hover:bg-zinc-50")}>
                        <span className="text-sm">{m}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}/>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Motif du prêt</Label>
              <FormField control={form.control} name="purpose" render={({ field }) => (
                <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-2">
                  {loanPurposes.map(p => (
                    <div key={p.id}>
                      <RadioGroupItem value={p.id} id={`lp-${p.id}`} className="sr-only" />
                      <Label htmlFor={`lp-${p.id}`} className={cn("flex items-center justify-center p-2 border-2 rounded-xl cursor-pointer transition-all text-[10px] font-black uppercase tracking-tighter text-center h-12", field.value === p.id ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-zinc-100 text-zinc-400 hover:bg-zinc-50")}>
                        {p.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}/>
            </div>

            <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 shadow-inner space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Échéance</span>
                    <span className="text-2xl font-black text-primary">{config.symbol}{calculation.monthlyPayment.toFixed(2)}</span>
                </div>
                <Separator className="bg-primary/10" />
                <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase">
                    <span>Intérêt total estimé</span>
                    <span className="text-green-600">+{config.symbol}{(calculation.totalRepayment - watchedAmount).toFixed(2)}</span>
                </div>
            </div>

            {collateralError && (
              <Alert variant="destructive" className="rounded-2xl bg-red-50 border-red-100">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-bold">{collateralError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" variant="gradient" className="w-full h-16 text-xl font-black shadow-xl rounded-2xl uppercase tracking-tighter" disabled={!!collateralError || isSubmitting || !user}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <ShieldCheck className="mr-2"/>}
              Soumettre le dossier
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
