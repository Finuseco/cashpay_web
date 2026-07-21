

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import React from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

// Logo Components
const CanalPlusLogo = () => <div className="flex items-center justify-center h-12 w-24 rounded-md bg-white p-1"><Image src="/logos/canalplus.png" alt="Canal+" width={96} height={48} objectFit="contain" /></div>;
const StarTimesLogo = () => <div className="flex items-center justify-center h-12 w-24 rounded-md bg-white p-1"><Image src="/logos/startimes.png" alt="StarTimes" width={96} height={48} objectFit="contain" /></div>;
const EasyTvLogo = () => <div className="flex items-center justify-center h-12 w-24 rounded-md bg-white p-1"><Image src="/logos/easytv.png" alt="EasyTV" width={96} height={48} objectFit="contain" /></div>;
const StarlinkLogo = () => <div className="flex items-center justify-center h-12 w-24 rounded-md bg-white p-1"><Image src="/logos/starlink.png" alt="Starlink" width={96} height={48} objectFit="contain" /></div>;
const BlueSatLogo = () => <div className="flex items-center justify-center h-12 w-24 rounded-md bg-white p-1"><Image src="/logos/bleusat.png" alt="BlueSat" width={96} height={48} objectFit="contain" /></div>;


const allProviders = [
  { id: "canal_plus", name: "Canal+", logo: <CanalPlusLogo /> },
  { id: "startimes", name: "StarTimes", logo: <StarTimesLogo /> },
  { id: "easytv", name: "EasyTV", logo: <EasyTvLogo /> },
  { id: "starlink", name: "Starlink", logo: <StarlinkLogo /> },
  { id: "bluesat", name: "BlueSat", logo: <BlueSatLogo /> },
];

const bouquets: { [key: string]: { id: string; name: string; price: number }[] } = {
  canal_plus: [ { id: "evasion", name: "Evasion+", price: 20 }, { id: "tout_canal", name: "Tout Canal+", price: 50 }, { id: "access", name: "Access", price: 10 } ],
  startimes: [ { id: "smart", name: "Smart Bouquet", price: 15 }, { id: "super", name: "Super Bouquet", price: 25 }, { id: "basic", name: "Basic Bouquet", price: 8 } ],
  easytv: [ { id: "basic", name: "Basic Plan", price: 12 }, { id: "premium", name: "Premium Plan", price: 22 } ],
  starlink: [ { id: "residential", name: "Residential", price: 45 }, { id: "roam", name: "Roam", price: 60 } ],
  bluesat: [ { id: "discovery", name: "Discovery", price: 18 }, { id: "galaxy", name: "Galaxy", price: 35 } ],
};

const formSchema = z.object({
  provider: z.string({ required_error: "Please select a TV provider." }),
  smartcardNumber: z.string().min(5, { message: "Smartcard number must be at least 5 digits." }),
  bouquet: z.string({ required_error: "Please select a subscription plan." }),
});

export type TvSubscriptionFormValues = z.infer<typeof formSchema>;

interface TvSubscriptionFormProps {
    onSubmit: (values: TvSubscriptionFormValues) => Promise<void>;
    isSubmitting: boolean;
    providerFilter?: string;
}

export function TvSubscriptionForm({ onSubmit, isSubmitting, providerFilter }: TvSubscriptionFormProps) {
  const { t } = useTranslation();
  
  const providers = providerFilter ? allProviders.filter(p => p.id === providerFilter) : allProviders.filter(p => p.id !== 'starlink');

  const form = useForm<TvSubscriptionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        smartcardNumber: "",
        provider: providerFilter ? providerFilter : undefined,
    },
  });

  const selectedProvider = form.watch("provider");

  React.useEffect(() => {
    form.resetField("bouquet");
    if (providerFilter) {
      form.setValue("provider", providerFilter);
    }
  }, [selectedProvider, form, providerFilter]);

  const smartcardLabel = providerFilter === 'starlink' ? "Numéro du Kit Starlink" : t('tvSubSmartcardLabel');
  const smartcardPlaceholder = providerFilter === 'starlink' ? "Entrez votre numéro de kit" : t('tvSubSmartcardPlaceholder');


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {!providerFilter && (
            <FormField
            control={form.control}
            name="provider"
            render={({ field }) => (
                <FormItem className="space-y-3">
                <FormLabel>{t('tvSubSelectProvider')}</FormLabel>
                <FormControl>
                    <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid grid-cols-2 md:grid-cols-3 gap-4"
                    >
                    {providers.map((op) => (
                        <FormItem key={op.id}>
                        <FormControl>
                            <RadioGroupItem value={op.id} id={`op-${op.id}`} className="sr-only" />
                        </FormControl>
                        <FormLabel
                            htmlFor={`op-${op.id}`}
                            className={cn(
                            "flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer h-24",
                            field.value === op.id && "border-primary"
                            )}
                        >
                            {op.logo}
                        </FormLabel>
                        </FormItem>
                    ))}
                    </RadioGroup>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        )}
        

        <FormField
          control={form.control}
          name="smartcardNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{smartcardLabel}</FormLabel>
              <FormControl>
                <Input type="text" placeholder={smartcardPlaceholder} {...field} />
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
              <FormItem>
                <FormLabel>{t('tvSubPlanLabel')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('tvSubPlanPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {bouquets[selectedProvider].map((bouquet) => (
                      <SelectItem key={bouquet.id} value={bouquet.id}>
                        {bouquet.name} - ${bouquet.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" variant="gradient" className="w-full font-bold" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('tvSubSubmitButton')}
        </Button>
      </form>
    </Form>
  );
}
