'use client';

import React from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { User } from '@/lib/types';
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";

const depositSchema = z.object({
  amount: z.coerce.number().min(1, "Le montant doit être supérieur à 0."),
  phoneNumber: z.string().min(9, "Le numéro de téléphone est requis."),
});

interface MobileMoneyDepositFormProps {
    user: User;
    country: { code: string; name: string; dialCode: string };
    operator: string;
    onSubmit: (values: any) => void;
    isSubmitting: boolean;
}

export const MobileMoneyDepositForm = ({ user, country, operator, onSubmit, isSubmitting }: MobileMoneyDepositFormProps) => {
  const { t } = useTranslation();

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: undefined,
      phoneNumber: user.phone?.slice(-9) || '',
    },
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between bg-primary/5 p-3 rounded-lg border border-primary/10">
          <span className="text-sm font-bold text-primary uppercase">{operator}</span>
          <span className="text-xs text-muted-foreground">{country.name}</span>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
              <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>{t('depositAmountLabel', 'Montant à déposer (USD)')}</FormLabel>
                      <FormControl>
                          <Input 
                              type="number" 
                              placeholder="0.00" 
                              {...field} 
                              value={field.value || ''} 
                              className="h-12 text-lg font-bold" 
                          />
                      </FormControl>
                      <FormMessage />
                  </FormItem>
                  )}
              />

              <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                  <FormItem>
                      <FormLabel>{t('depositPhoneNumberLabel', 'Numéro de téléphone')}</FormLabel>
                      <div className="flex gap-2">
                          <div className="flex items-center justify-center px-4 rounded-md border bg-muted font-bold text-zinc-500 h-12">
                              {country.dialCode}
                          </div>
                          <FormControl className="flex-1">
                              <Input 
                                  type="tel" 
                                  placeholder="000 000 000" 
                                  {...field} 
                                  className="h-12 text-lg font-mono tracking-widest" 
                              />
                          </FormControl>
                      </div>
                      <FormMessage />
                  </FormItem>
                  )}
              />
          </div>
          
          <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
              {t('depositConfirmButton', "DEMANDER LE DÉPÔT")}
          </Button>

          <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest">
              Paiement sécurisé par la passerelle MaxiCash
          </p>
        </form>
      </Form>
    </div>
  );
}
