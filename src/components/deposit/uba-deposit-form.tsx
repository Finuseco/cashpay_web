
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const ubaDepositSchema = z.object({
  amount: z.coerce.number().min(1, "Le montant doit être supérieur à 0."),
  currency: z.string().default('NGN'), // API seems to require NGN
});

interface UbaDepositFormProps {
    user: User | null;
    onSubmit: (values: any) => void;
    isSubmitting: boolean;
}

export const UbaDepositForm = ({ user, onSubmit, isSubmitting }: UbaDepositFormProps) => {
  const { t } = useTranslation();
  
  const form = useForm<z.infer<typeof ubaDepositSchema>>({
    resolver: zodResolver(ubaDepositSchema),
    defaultValues: { 
        amount: undefined, 
        currency: 'NGN',
    }
  });
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
         <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>{t('depositAmountLabel')}</FormLabel>
                    <FormControl><Input type="number" placeholder="1000" {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>{t('depositCurrencyLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled>
                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="NGN">NGN</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <p className="text-xs text-muted-foreground">L'API UBA (via SeerBit) ne prend actuellement en charge que les dépôts en NGN (Naira Nigérian). Le montant sera converti dans votre portefeuille USD.</p>
        <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Générer un Compte de Dépôt
        </Button>
      </form>
    </Form>
  )
}
