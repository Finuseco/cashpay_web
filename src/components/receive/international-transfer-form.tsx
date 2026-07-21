
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import Image from "next/image";
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
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitTransferClaim } from "@/lib/actions/transfer.actions";
import type { User, Country } from '@/lib/types';
import { trackWesternUnionTransfer } from "@/services/western-union";
import { trackMoneyGramTransfer } from "@/services/moneygram";
import { trackRiaTransfer } from "@/services/ria";
import type { WesternUnionTransferDetails, MoneyGramTransferDetails, RiaTransferDetails } from '@/lib/types';
import { Loader2, CheckCircle } from 'lucide-react';
import { Label } from "../ui/label";

// Mock logos for international transfer services
const WesternUnionLogo = () => <div className="flex items-center justify-center h-12 w-full rounded-md bg-white p-1"><Image src="/logos/westernunion.png" alt="Western Union" width={96} height={48} objectFit="contain" /></div>;
const MoneyGramLogo = () => <div className="flex items-center justify-center h-12 w-full rounded-md bg-white p-1"><Image src="/logos/moneygram.png" alt="MoneyGram" width={96} height={48} objectFit="contain" /></div>;
const RiaLogo = () => <div className="flex items-center justify-center h-12 w-full rounded-md bg-white p-1"><Image src="/logos/ria.png" alt="Ria" width={96} height={48} objectFit="contain" /></div>;

const providers = [
  { id: "western_union", name: "Western Union", logo: <WesternUnionLogo /> },
  { id: "moneygram", name: "MoneyGram", logo: <MoneyGramLogo /> },
  { id: "ria", name: "RIA", logo: <RiaLogo /> },
];

const formSchema = z.object({
  provider: z.string({ required_error: "Veuillez sélectionner un fournisseur." }),
  trackingNumber: z.string().min(8, { message: "Le numéro de suivi doit contenir au moins 8 caractères." }),
  receiveInCurrency: z.enum(['USD', 'EUR', 'CDF'], { required_error: "Veuillez sélectionner une devise de réception." }),
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
  
  const trackingNumberValue = form.watch('trackingNumber');
  const providerValue = form.watch('provider');

  const handleVerifyTracking = async () => {
      setIsLoading(true);
      setTransferDetails(null);
      form.clearErrors('trackingNumber');
      
      let result;
      switch(providerValue) {
        case 'western_union':
            result = await trackWesternUnionTransfer(trackingNumberValue);
            break;
        case 'moneygram':
            result = await trackMoneyGramTransfer(trackingNumberValue);
            break;
        case 'ria':
            result = await trackRiaTransfer(trackingNumberValue);
            break;
        default:
            result = { success: false, error: 'Fournisseur non supporté.' };
      }

      if (result.success) {
          setTransferDetails(result as TransferDetails);
      } else {
          form.setError('trackingNumber', { type: 'manual', message: result.error });
      }
      setIsLoading(false);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !transferDetails) {
        openAlert({ variant: 'error', title: 'Erreur', description: 'Veuillez d\'abord vérifier un numéro de suivi valide.' });
        return;
    }
    
    setIsSubmitting(true);
    const result = await submitTransferClaim({
        user,
        provider: values.provider as 'western_union' | 'moneygram' | 'ria',
        trackingNumber: values.trackingNumber,
        senderCountry: transferDetails.senderCountry,
        amount: transferDetails.amount,
        currency: transferDetails.currency,
        receiveInCurrency: values.receiveInCurrency
    });

    if(result.success) {
        openAlert({
            variant: "success",
            title: "Réclamation Soumise",
            description: "Votre demande a bien été reçue. Les fonds seront crédités sur votre portefeuille après validation par notre équipe.",
        });
        form.reset({
            provider: "western_union",
            trackingNumber: "",
            receiveInCurrency: 'USD',
        });
        setTransferDetails(null);
    } else {
        openAlert({ variant: 'error', title: 'Erreur', description: result.error });
    }
    setIsSubmitting(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('receiveIntlTransferTitle')}</CardTitle>
        <CardDescription>{t('receiveIntlTransferDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{isClient ? t('intlTransferSelectProvider') : 'Select Provider'}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                          field.onChange(value);
                          setTransferDetails(null);
                          form.resetField('trackingNumber');
                      }}
                      defaultValue={field.value}
                      className="grid grid-cols-3 gap-4"
                    >
                      {providers.map((p) => (
                        <FormItem key={p.id}>
                          <FormControl>
                            <RadioGroupItem value={p.id} id={`p-${p.id}`} className="sr-only" />
                          </FormControl>
                          <FormLabel
                            htmlFor={`p-${p.id}`}
                            className={cn(
                              "flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer h-20",
                              field.value === p.id && "border-primary"
                            )}
                          >
                            {p.logo}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trackingNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isClient ? t('intlTransferTrackingNumberLabel') : 'Tracking Number (MTCN / Reference)'}</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                        <Input type="text" placeholder={isClient ? t('intlTransferTrackingNumberPlaceholder') : 'Enter tracking number'} {...field} />
                    </FormControl>
                    <Button type="button" onClick={handleVerifyTracking} disabled={isLoading || field.value.length < 8}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Vérifier"}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {transferDetails && (
                <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 font-bold"><CheckCircle className="h-5 w-5"/> Transfert Valide</div>
                    <p><strong>Expéditeur:</strong> {transferDetails.senderName} ({transferDetails.senderCountry})</p>
                    <p><strong>Montant:</strong> {transferDetails.amount} {transferDetails.currency}</p>
                </div>
            )}
            
            <div className="space-y-2">
                <Label>Nom Complet du Bénéficiaire</Label>
                <Input type="text" value={user?.full_name || ''} readOnly className="bg-muted/50"/>
            </div>

            <FormField
              control={form.control}
              name="receiveInCurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recevoir les fonds dans le portefeuille</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez une devise" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="USD">Portefeuille USD</SelectItem>
                        <SelectItem value="EUR">Portefeuille EUR</SelectItem>
                        <SelectItem value="CDF">Portefeuille CDF</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" variant="gradient" className="w-full" disabled={!transferDetails || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isClient ? t('intlTransferSubmitButton') : 'Submit Claim'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
