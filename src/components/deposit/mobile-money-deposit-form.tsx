
'use client';

import React, { useEffect, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import Image from 'next/image';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { User, Country } from '@/lib/types';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { verifyMpesaAccountHolder } from "@/services/mpesa";
import { debounce } from "lodash";
import { verifyAirtelAccountHolder } from "@/services/airtel";
import { validateAccountHolder as validateMtnAccount } from "@/services/mtn";

const mobileMoneySchema = z.object({
  operator: z.string({ required_error: "Veuillez sélectionner un opérateur." }),
  amount: z.coerce.number().min(1, "Le montant doit être supérieur à 0."),
  phoneNumber: z.string().min(9, "Le numéro de téléphone est requis."),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
});

const ALL_OPERATORS = {
    'mpesa': { id: 'mpesa', name: 'M-Pesa', logo: '/logos/mpesa.png' },
    'orange': { id: 'orange', name: 'Orange Money', logo: '/logos/orangemoney.png' },
    'airtel': { id: 'airtel', name: 'Airtel Money', logo: '/logos/airtelmoney.png' },
    'mtn': { id: 'mtn', name: 'MTN MoMo', logo: '/logos/mtn.png' },
    'afrimoney': { id: 'afrimoney', name: 'Afrimoney', logo: '/logos/airtime_africell.png' },
    'moov': { id: 'moov', name: 'Moov Money', logo: '/logos/moov.png' },
};

const OPERATORS_BY_COUNTRY: Record<string, (keyof typeof ALL_OPERATORS)[]> = {
    'CD': ['mpesa', 'orange', 'airtel', 'afrimoney'],
    'CG': ['mtn', 'airtel'],
    'GA': ['airtel', 'moov'],
    'SN': ['orange', 'free'],
    'KE': ['mpesa', 'airtel'],
    'NG': ['mtn', 'airtel'],
};

const CURRENCIES_BY_OPERATOR: Record<string, Record<string, string[]>> = {
  'CD': { 
    'mpesa': ['USD', 'CDF'], 
    'orange': ['USD', 'CDF'], 
    'airtel': ['USD', 'CDF'], 
    'afrimoney': ['USD', 'CDF'] 
  },
  'CG': { 'mtn': ['XAF'], 'airtel': ['XAF'] },
  'GA': { 'airtel': ['XAF'], 'moov': ['XAF'] },
  'SN': { 'orange': ['XOF'], 'mtn': ['XOF'] },
};

export const MobileMoneyDepositForm = ({ user, country, onSubmit, isSubmitting }: { user: User | null, country: Country, onSubmit: (values: any) => void, isSubmitting: boolean }) => {
  const { t } = useTranslation();
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [verifiedName, setVerifiedName] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof mobileMoneySchema>>({
    resolver: zodResolver(mobileMoneySchema),
    defaultValues: {
      amount: undefined,
      phoneNumber: user?.phone?.slice(-9) || '',
      currency: country.currency_code || 'USD'
    },
  });
  
  const selectedOperator = form.watch("operator");
  const phoneNumberValue = form.watch('phoneNumber');
  
  const availableOperators = useMemo(() => {
    const keys = OPERATORS_BY_COUNTRY[country.code] || ['mpesa', 'airtel', 'orange'];
    return keys.map(key => ALL_OPERATORS[key as keyof typeof ALL_OPERATORS]).filter(Boolean);
  }, [country.code]);

  const availableCurrencies = useMemo(() => {
    const defaultCurrencies = ['USD'];
    if (selectedOperator) {
        const operatorCurrencies = CURRENCIES_BY_OPERATOR[country.code]?.[selectedOperator] || [country.currency_code];
        return Array.from(new Set([...defaultCurrencies, ...operatorCurrencies]));
    }
    return defaultCurrencies;
  }, [selectedOperator, country.code, country.currency_code]);
  
  const debouncedVerify = useCallback(debounce(async (phone: string, operator: string) => {
    if (!phone || phone.length < 9) {
      setVerifiedName(null);
      return;
    }
    setIsVerifying(true);
    
    let result: { success: boolean; name?: string; error?: string };
    const fullPhoneNumber = `${country.dial_code}${phone}`;

    if (operator === 'mpesa') {
        result = await verifyMpesaAccountHolder(phone, `vodacom${country.code}`);
    } else if (operator === 'airtel') {
        result = await verifyAirtelAccountHolder(fullPhoneNumber);
    } else if (operator === 'mtn') {
        const validationResult = await validateMtnAccount(fullPhoneNumber, `mtn${country.name.toLowerCase().replace(/ /g, '')}`);
        result = validationResult.success ? { success: true, name: 'Utilisateur Mobile Money Valide' } : { success: false, error: validationResult.error };
    } else {
        result = { success: true, name: 'Compte prêt à être débité' };
    }

    if (result.success && result.name) {
      setVerifiedName(result.name);
      form.clearErrors('phoneNumber');
    } else {
      setVerifiedName(null);
      form.setError('phoneNumber', { type: 'manual', message: result.error || t('idNotFoundError', 'Identité introuvable sur le réseau.') });
    }
    setIsVerifying(false);
  }, 600), [form, country.code, country.dial_code, country.name, t]);


  useEffect(() => {
      if (selectedOperator) {
        debouncedVerify(phoneNumberValue, selectedOperator);
      }
      return () => debouncedVerify.cancel();
  }, [phoneNumberValue, selectedOperator, debouncedVerify]);
  
  const selectedOperatorName = ALL_OPERATORS[selectedOperator as keyof typeof ALL_OPERATORS]?.name;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="operator"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="font-bold text-zinc-500 uppercase text-[10px] tracking-widest">{t('depositSelectOperator')} ({country.name})</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="grid grid-cols-3 md:grid-cols-5 gap-3"
                >
                  {availableOperators.map((op) => (
                    <FormItem key={op.id}>
                      <FormControl>
                        <RadioGroupItem value={op.id} id={`op-dep-${op.id}`} className="sr-only" />
                      </FormControl>
                      <label
                        htmlFor={`op-dep-${op.id}`}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-2xl border-2 border-muted bg-popover p-2 aspect-square hover:bg-accent hover:border-primary/50 transition-all cursor-pointer",
                          field.value === op.id ? "border-primary bg-primary/5 shadow-inner" : "border-transparent"
                        )}
                      >
                         <Image src={op.logo} alt={op.name} width={48} height={48} className="object-contain rounded-lg" />
                         <span className="text-[8px] font-bold mt-1 uppercase text-zinc-500">{op.name.split(' ')[0]}</span>
                      </label>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('depositAmountLabel', 'Montant')}</FormLabel>
                    <FormControl><Input type="number" placeholder="0.00" {...field} value={field.value || ''} className="h-12 text-lg font-bold" /></FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
             <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>{t('depositCurrencyLabel', 'Devise')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-12 font-semibold"><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent>
                           {availableCurrencies.map(curr => <SelectItem key={curr} value={curr}>{curr}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
            <FormItem>
                <FormLabel>
                    {selectedOperatorName ? t('depositOperatorNumber', { operator: selectedOperatorName }) : t('depositPhoneNumberLabel')}
                </FormLabel>
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400">{country.dial_code}</div>
                    <FormControl><Input type="tel" placeholder="000 000 000" {...field} className="h-12 pl-16 text-lg font-mono tracking-widest" /></FormControl>
                    {isVerifying && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
                </div>
                 {verifiedName && (
                    <div className="flex items-center gap-2 p-3 mt-2 rounded-lg bg-green-500/10 text-green-600 text-xs font-bold border border-green-500/20">
                        <UserCheck className="h-4 w-4"/> {t('accountIdentified', 'Compte identifié')} : {verifiedName}
                    </div>
                )}
                <FormMessage />
            </FormItem>
            )}
        />
        
        <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl" disabled={isSubmitting || isVerifying || !verifiedName || !selectedOperator}>
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
            {t('depositConfirmButton', "VALIDER L'APPROVISIONNEMENT")}
        </Button>
      </form>
    </Form>
  )
}
