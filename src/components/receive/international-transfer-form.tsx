'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { cn } from "@/lib/utils";
import { submitTransferClaim } from "@/lib/actions/transfer.actions";
import type { User, Country } from '@/lib/types';
import { trackWesternUnionTransfer, type WesternUnionTransferDetails } from "@/services/western-union";
import { trackMoneyGramTransfer, type MoneyGramTransferDetails } from "@/services/moneygram";
import { trackRiaTransfer, type RiaTransferDetails } from "@/services/ria";
import { Loader2, CheckCircle, Globe, ShieldCheck, Check } from 'lucide-react';
import { Label } from "../ui/label";
import Image from "next/image";

const formSchema = z.object({
  provider: z.string({ required_error: "Veuillez sélectionner un fournisseur." }),
  trackingNumber: z.string().min(8, { message: "Numéro de suivi requis." }),
  receiveInCurrency: z.string({ required_error: "Veuillez sélectionner une devise." }),
});

type TransferDetails = WesternUnionTransferDetails | MoneyGramTransferDetails | RiaTransferDetails;

export function InternationalTransferForm({ user, countries }: { user: User | null, countries: Country[] }) {
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferDetails, setTransferDetails] = useState<TransferDetails | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        provider: "western_union",
        trackingNumber: "",
        receiveInCurrency: 'USD',
    },
  });
  
  const providers = [
    { id: "western_union", name: "Western Union", logo: "/logos/westernunion.png" },
    { id: "moneygram", name: "MoneyGram", logo: "/logos/moneygram.png" },
    { id: "ria", name: "RIA", logo: "/logos/ria.png" },
  ];

  const handleVerifyTracking = async () => {
      const { trackingNumber, provider } = form.getValues();
      if (!trackingNumber) return;

      setIsLoading(true);
      setTransferDetails(null);
      
      let result;
      try {
          if (provider === 'western_union') result = await trackWesternUnionTransfer(trackingNumber);
          else if (provider === 'moneygram') result = await trackMoneyGramTransfer(trackingNumber);
          else result = await trackRiaTransfer(trackingNumber);

          if (result && result.success) {
              setTransferDetails(result as TransferDetails);
          } else {
              openAlert({ 
                title: 'Transfert introuvable', 
                description: result?.error || 'Veuillez vérifier le numéro saisi et le fournisseur sélectionné.', 
                variant: 'error' 
              });
          }
      } catch (e) {
          openAlert({ title: 'Erreur technique', description: 'Le service de vérification est momentanément indisponible.', variant: 'error' });
      } finally {
          setIsLoading(false);
      }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !transferDetails) return;
    
    setIsSubmitting(true);
    try {
        const result = await submitTransferClaim({
            user,
            provider: values.provider as any,
            trackingNumber: values.trackingNumber,
            senderCountry: transferDetails.senderCountry,
            amount: transferDetails.amount,
            currency: transferDetails.currency,
            receiveInCurrency: values.receiveInCurrency as any
        });

        if(result.success) {
            openAlert({
                variant: "success",
                title: "Réclamation Soumise",
                description: "Votre demande a bien été reçue. Elle sera validée par nos agents sous 24h.",
            });
            form.reset();
            setTransferDetails(null);
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
    } catch (e) {
        openAlert({ title: 'Erreur', description: 'Une erreur est survenue lors de la soumission.', variant: 'error' });
    } finally {
        setIsSubmitting(false);
    }
  }

  if (!isClient) return null;

  return (
    <Card className="border-none shadow-xl bg-background">
      <CardHeader className="bg-primary/5 border-b border-primary/10 text-center">
        <CardTitle className="flex items-center justify-center gap-2"><Globe className="text-primary"/> Réclamer un Transfert</CardTitle>
        <CardDescription>Récupérez vos fonds internationaux sur votre portefeuille souverain.</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem className="space-y-4">
                  <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Service d'origine</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={(val) => { field.onChange(val); setTransferDetails(null); }} defaultValue={field.value} className="grid grid-cols-3 gap-2">
                      {providers.map((p) => (
                        <div key={p.id}>
                          <RadioGroupItem value={p.id} id={`p-${p.id}`} className="sr-only" />
                          <Label htmlFor={`p-${p.id}`} className={cn(
                            "flex flex-col items-center justify-center rounded-xl border-2 p-2 h-20 cursor-pointer transition-all",
                            field.value === p.id ? "border-primary bg-primary/5 shadow-sm" : "border-zinc-100 hover:bg-zinc-50"
                          )}>
                            <div className="relative h-8 w-full">
                                <Image src={p.logo} alt={p.name} fill className="object-contain" />
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trackingNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Code de suivi (MTCN / PIN / REF)</FormLabel>
                  <div className="flex gap-2">
                    <FormControl><Input placeholder="Saisir le code..." {...field} className="h-12 text-lg font-mono tracking-widest" /></FormControl>
                    <Button type="button" onClick={handleVerifyTracking} disabled={isLoading || field.value.length < 8} className="h-12 px-6 font-bold">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Vérifier"}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {transferDetails && (
                <div className="p-5 bg-green-50 border border-green-200 text-green-800 rounded-2xl space-y-2 animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-2 font-black uppercase text-xs tracking-widest"><CheckCircle className="h-4 w-4"/> Transfert Identifié</div>
                    <div className="text-sm">
                        <p>Expéditeur : <span className="font-black uppercase">{transferDetails.senderName}</span></p>
                        <p>Pays d'origine : <span className="font-bold">{transferDetails.senderCountry}</span></p>
                    </div>
                    <p className="text-2xl font-black mt-2">Montant : {transferDetails.amount.toLocaleString()} {transferDetails.currency}</p>
                </div>
            )}
            
            <div className="space-y-4">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Portefeuille de crédit</Label>
                <FormField
                    control={form.control}
                    name="receiveInCurrency"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-3 gap-2">
                                    {['USD', 'EUR', 'CDF'].map(cur => (
                                        <div key={cur} className="relative">
                                            <RadioGroupItem value={cur} id={`rec-${cur}`} className="sr-only" />
                                            <Label htmlFor={`rec-${cur}`} className={cn(
                                                "flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all h-16",
                                                field.value === cur ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-zinc-100 text-zinc-500 hover:bg-zinc-50"
                                            )}>
                                                <span className="font-black text-sm">{cur}</span>
                                                {field.value === cur && <div className="absolute top-1 right-1"><Check className="h-3 w-3 text-primary" /></div>}
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <Button type="submit" variant="gradient" className="w-full h-16 text-lg font-black shadow-xl" disabled={!transferDetails || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2" />}
              CRÉDITER MON COMPTE
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
