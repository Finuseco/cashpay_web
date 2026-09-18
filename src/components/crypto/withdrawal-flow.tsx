
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User, CryptoBalance } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { requestCryptoWithdrawal } from '@/lib/actions/crypto.actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const withdrawalSchema = z.object({
  amount: z.coerce.number().min(0.0001, "Le montant est trop faible."),
  crypto: z.string({ required_error: "Veuillez sélectionner une cryptomonnaie." }),
  recipientAddress: z.string().min(20, "L'adresse du destinataire est requise."),
});

interface WithdrawalFlowProps {
    user: User;
    balances: CryptoBalance[];
}

export function WithdrawalFlow({ user, balances }: WithdrawalFlowProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { openAlert } = useAlertDialog();
    
    const form = useForm<z.infer<typeof withdrawalSchema>>({
        resolver: zodResolver(withdrawalSchema),
        defaultValues: { crypto: 'BTC' }
    });
    
    const selectedCrypto = form.watch('crypto');
    const balance = balances.find(b => b.currency_code === selectedCrypto)?.balance || 0;

    const onSubmit = async (values: z.infer<typeof withdrawalSchema>) => {
        setIsLoading(true);
        const result = await requestCryptoWithdrawal({
            user,
            amount: values.amount,
            currency: values.crypto,
            recipientAddress: values.recipientAddress,
        });

        if (result.success) {
            openAlert({
                variant: 'success',
                title: 'Demande de Retrait Soumise',
                description: `Votre demande de retrait de ${values.amount} ${values.crypto} a été soumise. Elle sera traitée après les confirmations réseau.`
            });
            form.reset();
        } else {
             openAlert({
                variant: 'error',
                title: 'Erreur de Retrait',
                description: result.error,
            });
        }
        setIsLoading(false);
    };

    return (
        <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
                <CardTitle>Retrait en Cryptomonnaie</CardTitle>
                <CardDescription>Transférez vos fonds vers un portefeuille crypto externe.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField control={form.control} name="crypto" render={({ field }) => ( 
                            <FormItem>
                                <FormLabel>Retirer en</FormLabel>
                                <FormControl>
  <div className="space-y-2">
    {balances.map(b => (
      <label
        key={b.currency_code}
        className="flex items-center gap-3 rounded-lg border border-zinc-600 bg-zinc-700 p-3 text-white"
      >
        <input
          type="radio"
          name="withdrawal-currency"
          value={b.currency_code}
          checked={field.value === b.currency_code}
          onChange={() => field.onChange(b.currency_code)}
        />
        <span>{b.currency_code} (Solde: {b.balance.toFixed(8)})</span>
      </label>
    ))}
  </div>
</FormControl>
                                <FormMessage />
                            </FormItem> 
                        )}/>
                        <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} className="bg-zinc-700 border-zinc-600" /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="recipientAddress" render={({ field }) => ( <FormItem><FormLabel>Adresse du destinataire</FormLabel><FormControl><Input {...field} className="bg-zinc-700 border-zinc-600" /></FormControl><FormMessage /></FormItem> )}/>
                        
                        <p className="text-sm text-center text-zinc-400">Des frais de réseau s'appliqueront et seront déduits du montant envoyé.</p>
                        
                        <Button type="submit" variant="default" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Demander le Retrait
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
