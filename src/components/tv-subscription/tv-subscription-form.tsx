
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Loader2, Tv, ShieldCheck, Check } from "lucide-react";

const allProviders = [
  { id: "canal_plus", name: "Canal+", logo: "/logos/canalplus.png" },
  { id: "startimes", name: "StarTimes", logo: "/logos/startimes.png" },
  { id: "easytv", name: "EasyTV", logo: "/logos/easytv.png" },
  { id: "starlink", name: "Starlink", logo: "/logos/starlink.png" },
  { id: "bluesat", name: "BlueSat", logo: "/logos/bleusat.png" },
];

const bouquets: { [key: string]: { id: string; name: string; price: number }[] } = {
  canal_plus: [ { id: "evasion", name: "Evasion+", price: 20 }, { id: "tout_canal", name: "Tout Canal+", price: 50 }, { id: "access", name: "Access", price: 10 } ],
  startimes: [ { id: "smart", name: "Smart Bouquet", price: 15 }, { id: "super", name: "Super Bouquet", price: 25 }, { id: "basic", name: "Basic Bouquet", price: 8 } ],
  easytv: [ { id: "basic", name: "Basic Plan", price: 12 }, { id: "premium", name: "Premium Plan", price: 22 } ],
  starlink: [ { id: "residential", name: "Residential", price: 45 }, { id: "roam", name: "Roam", price: 60 } ],
  bluesat: [ { id: "discovery", name: "Discovery", price: 18 }, { id: "galaxy", name: "Galaxy", price: 35 } ],
};

const formSchema = z.object({
  provider: z.string({ required_error: "Veuillez sélectionner un opérateur." }),
  smartcardNumber: z.string().min(5, { message: "Le numéro de carte doit contenir au moins 5 chiffres." }),
  bouquet: z.string({ required_error: "Veuillez sélectionner un forfait." }),
});

export type TvSubscriptionFormValues = z.infer<typeof formSchema>;

interface TvSubscriptionFormProps {
    onSubmit: (values: TvSubscriptionFormValues) => Promise<void>;
    isSubmitting: boolean;
    providerFilter?: string;
}

export function TvSubscriptionForm({ onSubmit, isSubmitting, providerFilter }: TvSubscriptionFormProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  
  const providers = providerFilter ? allProviders.filter(p => p.id === providerFilter) : allProviders.filter(p => p.id !== 'starlink');

  const form = useForm<TvSubscriptionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        smartcardNumber: "",
        provider: providerFilter ? providerFilter : "",
        bouquet: "",
    },
  });

  const selectedProvider = form.watch("provider");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && selectedProvider) {
        form.setValue("bouquet", "");
    }
  }, [selectedProvider, form, mounted]);

  const smartcardLabel = providerFilter === 'starlink' ? "Numéro du Kit Starlink" : "Numéro de carte à puce / décodeur";
  const smartcardPlaceholder = providerFilter === 'starlink' ? "KIT-00000000" : "0000 0000 0000";

  if (!mounted) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary"/></div>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {!providerFilter && (
            <FormField
            control={form.control}
            name="provider"
            render={({ field }) => (
                <FormItem className="space-y-4">
                <FormLabel className="text-xs font-black uppercase tracking-widest text-zinc-500">Sélectionner un fournisseur</FormLabel>
                <FormControl>
                    <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                    >
                    {providers.map((op) => (
                        <div key={op.id}>
                            <RadioGroupItem value={op.id} id={`op-${op.id}`} className="sr-only" />
                            <Label
                                htmlFor={`op-${op.id}`}
                                className={cn(
                                "flex flex-col items-center justify-center rounded-2xl border-2 p-3 h-24 cursor-pointer transition-all hover:bg-zinc-50",
                                field.value === op.id ? "border-primary bg-primary/5 shadow-sm" : "border-zinc-100"
                                )}
                            >
                                <div className="relative h-10 w-full mb-1 flex items-center justify-center">
                                    <img src={op.logo} alt={op.name} className="max-h-full max-w-full object-contain" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-center text-zinc-600">{op.name}</span>
                            </Label>
                        </div>
                    ))}
                    </RadioGroup>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
                control={form.control}
                name="smartcardNumber"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-wide text-zinc-600">{smartcardLabel}</FormLabel>
                        <FormControl>
                            <Input type="text" placeholder={smartcardPlaceholder} {...field} className="h-12 bg-zinc-50 border-zinc-200 font-mono tracking-widest" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            
            {selectedProvider && bouquets[selectedProvider] && (
                <FormField
                    control={form.control}
                    name="bouquet"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <FormLabel className="text-xs font-black uppercase tracking-widest text-zinc-500">Choisir un forfait</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 gap-2">
                                    {bouquets[selectedProvider].map((b) => (
                                        <div key={b.id}>
                                            <RadioGroupItem value={b.id} id={`b-${b.id}`} className="sr-only" />
                                            <Label htmlFor={`b-${b.id}`} className={cn(
                                                "flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all h-14",
                                                field.value === b.id ? "border-primary bg-primary/5 text-primary" : "border-zinc-100 hover:bg-zinc-50"
                                            )}>
                                                <span className="font-bold text-sm">{b.name}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black">${b.price}</span>
                                                    {field.value === b.id && <Check className="h-4 w-4" />}
                                                </div>
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}
        </div>

        <Button type="submit" variant="gradient" className="w-full h-16 text-xl font-black shadow-xl rounded-2xl uppercase tracking-tighter" disabled={isSubmitting || !selectedProvider || !form.watch('bouquet')}>
          {isSubmitting ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-3 h-5 w-5" />}
          Valider le réabonnement
        </Button>

        <p className="text-[10px] text-center text-zinc-400 font-bold uppercase tracking-widest">Paiement souverain sécurisé par portefeuille CashPay</p>
      </form>
    </Form>
  );
}
