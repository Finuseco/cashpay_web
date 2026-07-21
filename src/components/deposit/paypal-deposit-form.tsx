
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User } from '@/lib/types';
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import Image from "next/image";

const payPalFormSchema = z.object({
  amount: z.coerce.number().min(1, "Minimum 1.00 USD.").max(500, "Limite de 500.00 USD par transaction."),
});

interface PayPalDepositFormProps {
    user: User | null;
    onSubmit: (values: z.infer<typeof payPalFormSchema>) => Promise<void>;
    isSubmitting: boolean;
}

export function PayPalDepositForm({ user, onSubmit, isSubmitting }: PayPalDepositFormProps) {
  const form = useForm<z.infer<typeof payPalFormSchema>>({
    resolver: zodResolver(payPalFormSchema),
    defaultValues: { amount: 10 }
  });
  
  return (
    <Card className="border-zinc-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
            <Mail className="h-5 w-5"/> Compte PayPal
        </CardTitle>
        <CardDescription>
            Approvisionnez votre compte via votre solde PayPal ou votre compte lié. Limite de 500$ par opération.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Montant à déposer (USD)</FormLabel>
                        <FormControl><Input type="number" placeholder="10.00" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="p-4 bg-muted/30 rounded-lg flex items-center justify-center border border-dashed border-zinc-300">
                <Image src="/logos/paypal.png" alt="PayPal" width={100} height={25} className="opacity-80" />
            </div>

            <Button type="submit" variant="gradient" className="w-full font-bold h-12 text-lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Payer avec PayPal
            </Button>
            
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground justify-center">
                <ShieldCheck className="h-3 w-3 text-green-500" /> 
                Redirection sécurisée vers le portail officiel PayPal
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
