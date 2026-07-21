
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  amount: z.coerce.number().min(1, "Le montant est requis."),
  currency: z.string().default('RUB'),
  transactionReference: z.string().min(5, { message: "La référence de la transaction est requise." }),
  operator: z.string().default('wallet131') // Add this hidden field
});

export const Wallet131DepositForm = ({ user, onSubmit, isSubmitting }: { user: User | null, onSubmit: (values: any) => void, isSubmitting: boolean }) => {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        currency: 'RUB',
        amount: undefined, 
        transactionReference: '',
        operator: 'wallet131'
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t('depositWallet131Title')}</AlertTitle>
            <AlertDescription>
                <ol className="list-decimal pl-5 mt-2 space-y-1">
                    <li>{t('depositWallet131Step1')}</li>
                    <li>{t('depositWallet131Step2')}</li>
                    <li>{t('depositWallet131Step3')}</li>
                </ol>
            </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
                <FormItem>
                <FormLabel>{t('depositAmountDepositedLabel')}</FormLabel>
                <FormControl><Input type="number" placeholder="1000.00" {...field} value={field.value || ''} /></FormControl>
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
                        <SelectItem value="RUB">{t('depositCurrencyRUB')}</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
         <FormField
          control={form.control}
          name="transactionReference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('depositWallet131RefLabel')}</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('depositConfirmButton')}
        </Button>
      </form>
    </Form>
  )
}
