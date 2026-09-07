
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
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { ShieldAlert, Loader2, History, ShieldCheck, Check, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { User, Currency } from "@/lib/types";
import { createInvestment } from "@/lib/actions/investment.actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const formSchema = z.object({
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  amount: z.coerce.number().min(100, "Le montant minimum est de 100."),
  duration: z.coerce.number(),
  acceptTerms: z.boolean().refine(val => val === true, "Vous devez accepter les conditions.")
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
  const [mounted, setMounted] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 100,
      currency: "USD",
      duration: 12,
      acceptTerms: false,
    },
  });
  
  const pinForm = useForm<z.infer<typeof pinSchema>>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "" },
  });

  const watchAmount = form.watch("amount");
  const watchDuration = form.watch("duration");
  const watchCurrency = form.watch("currency");

  const calculation = useMemo(() => {
    const amount = Number(watchAmount);
    const duration = Number(watchDuration);
    if (amount >= 100 && duration > 0) {
      const interest = amount * 0.0366 * duration;
      return { total: amount + interest, interest, symbol: currencySymbols[watchCurrency] || '$' };
    }
    return { total: 0, interest: 0, symbol: currencySymbols[watchCurrency] || '$' };
  }, [watchAmount, watchDuration, watchCurrency]);

  const handleDetailsSubmit = (values: z.infer<typeof formSchema>) => {
    const selectedWallet = currencies.find(c => c.code === values.currency);
    const balanceNum = parseFloat(selectedWallet?.balance.replace(/,/g, '') || '0');
    
    if (balanceNum < values.amount) {
        openAlert({ title: "Solde insuffisant", description: `Votre solde en ${values.currency} est de ${selectedWallet?.balance}. Veuillez recharger votre compte.`, variant: "error" });
        return;
    }
    setIsPinDialogOpen(true);
  };
  
  const handleFinalSubmit = async (values: z.infer<typeof pinSchema>) => {
    if (!user) return;
    const details = form.getValues();
    setIsSubmitting(true);
    
    const result = await createInvestment({ user, ...details, pin: values.pin });
    
    setIsSubmitting(false);
    if (result.success) {
      openAlert({
        variant: "success",
        title: "Placement Validé",
        description: "Votre Dépôt à Terme a été enregistré avec succès.",
        onClose: () => {
          setIsPinDialogOpen(false);
          router.push('/investment/history');
        }
      });
      form.reset();
    } else {
      openAlert({ title: "Erreur", description: result.error, variant: 'error' });
      pinForm.reset();
    }
  };

  if (!mounted) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-xs p-8 rounded-[2rem]">
            <DialogHeader className="text-center">
                <div className="h-12 w-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-2"><ShieldCheck className="text-primary"/></div>
                <DialogTitle>Validation PIN</DialogTitle>
                <DialogDescription className="text-zinc-400">Confirmation du placement de {watchAmount} {watchCurrency}.</DialogDescription>
            </DialogHeader>
            <Form {...pinForm}>
                <form onSubmit={pinForm.handleSubmit(handleFinalSubmit)} className="space-y-6 pt-4 text-center">
                    <FormField control={pinForm.control} name="pin" render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <div className="flex justify-center">
                                    <InputOTP maxLength={4} {...field}>
                                        <InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup>
                                    </InputOTP>
                                </div>
                            </FormControl>
                        </FormItem>
                    )}/>
                    <Button type="submit" variant="gradient" className="w-full h-12 font-black" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "CONFIRMER LE DAT"}
                    </Button>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    
      <div className="flex justify-between items-center mb-2">
           <div>
               <h1 className="text-3xl font-black uppercase tracking-tighter text-primary">Placements (DAT)</h1>
               <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Épargne Souveraine Bloquée</p>
           </div>
           <Button asChild variant="outline" className="h-11 rounded-xl border-primary/20 text-primary">
              <Link href="/investment/history"><History className="mr-2 h-4 w-4" /> Historique</Link>
          </Button>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-zinc-50 border-b py-6">
          <CardTitle className="text-lg">Calculateur de Rendement</CardTitle>
          <CardDescription>Générez des intérêts de 3.66% par mois en bloquant vos fonds.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleDetailsSubmit)} className="space-y-8">
                
                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Portefeuille à débiter</Label>
                    <FormField control={form.control} name="currency" render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-3 gap-2">
                            {currencies.map(c => (
                                <div key={c.code}>
                                    <RadioGroupItem value={c.code} id={`curr-${c.code}`} className="sr-only" />
                                    <Label htmlFor={`curr-${c.code}`} className={cn("flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all h-16", field.value === c.code ? "border-primary bg-primary/5 text-primary font-black" : "border-zinc-100 text-zinc-400 hover:bg-zinc-50")}>
                                        <span className="text-sm">{c.code}</span>
                                        <span className="text-[8px] opacity-60 font-bold mt-1">{c.balance}</span>
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    )}/>
                </div>

                <FormField control={form.control} name="amount" render={({ field }) => ( 
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Capital à placer</FormLabel>
                        <FormControl><Input type="number" placeholder="100.00" {...field} className="h-16 text-4xl font-black text-center border-zinc-200 bg-zinc-50 rounded-2xl" /></FormControl>
                        <FormMessage />
                    </FormItem> 
                )} />

                <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Durée du blocage</Label>
                    <FormField control={form.control} name="duration" render={({ field }) => ( 
                        <RadioGroup onValueChange={(val) => field.onChange(Number(val))} value={field.value.toString()} className="grid grid-cols-3 gap-2">
                            {[6, 12, 24].map(m => (
                                <div key={m}>
                                    <RadioGroupItem value={m.toString()} id={`dur-${m}`} className="sr-only" />
                                    <Label htmlFor={`dur-${m}`} className={cn("flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all h-16", field.value === m ? "border-primary bg-primary/5 text-primary font-black" : "border-zinc-100 text-zinc-400 hover:bg-zinc-50")}>
                                        <span className="text-sm">{m} MOIS</span>
                                        <span className="text-[8px] uppercase font-bold text-green-600">{(m * 3.66).toFixed(1)}% Gain</span>
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    )}/>
                </div>

                <div className="p-6 bg-primary/5 rounded-[2.5rem] border-2 border-dashed border-primary/10 flex flex-col items-center gap-2 shadow-inner">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Rendement Total Estimé</p>
                    <p className="text-4xl font-black text-primary">
                        {calculation.symbol}{calculation.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                    <p className="text-xs font-bold text-green-600 flex items-center gap-1"><ArrowRight className="h-3 w-3"/> Dont {calculation.symbol}{calculation.interest.toFixed(2)} d'intérêts générés</p>
                </div>

                <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><ShieldCheck className="h-4 w-4"/> Garantie Souveraine CashPay</h4>
                    <div className="text-[11px] text-zinc-500 leading-relaxed space-y-2 font-medium">
                        <div className="flex gap-2"><Check className="h-3 w-3 text-green-500 shrink-0 mt-0.5"/> <p>Vos fonds sont sécurisés par l'infrastructure Finuseco.</p></div>
                        <div className="flex gap-2"><Check className="h-3 w-3 text-green-500 shrink-0 mt-0.5"/> <p>Le retrait anticipé entraîne une pénalité de 50% sur les intérêts cumulés.</p></div>
                    </div>
                    <FormField control={form.control} name="acceptTerms" render={({ field }) => ( 
                        <FormItem className="flex items-center space-x-3 space-y-0 rounded-2xl border p-4 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5"/></FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="text-xs font-black uppercase cursor-pointer text-primary leading-tight">J'accepte de bloquer mes fonds pour la durée choisie</FormLabel>
                            </div>
                        </FormItem> 
                    )}/>
                </div>

                <Button type="submit" variant="gradient" className="w-full h-16 text-xl font-black shadow-xl rounded-2xl uppercase tracking-tighter" disabled={!form.formState.isValid || isSubmitting}>
                    DÉPOSER ET BLOQUER
                </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
