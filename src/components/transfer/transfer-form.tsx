

'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InternationalWalletInput } from '../shared/international-wallet-input';
import type { User } from '@/lib/types';
import { createTransaction } from '@/lib/actions/transaction.actions';

const transferSchema = z.object({
  recipientWalletId: z
    .string()
    .min(12, { message: 'L\'ID du portefeuille doit contenir 12 caractères.' })
    .max(12, { message: 'L\'ID du portefeuille doit contenir 12 caractères.' }),
  amount: z.coerce
    .number()
    .positive({ message: 'Le montant doit être un nombre positif.' }),
  pin: z
    .string()
    .length(4, { message: 'Le code PIN doit contenir 4 chiffres.' }),
});

type TransferFormValues = z.infer<typeof transferSchema>;

export function TransferForm({ user }: { user: User }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      recipientWalletId: '',
      amount: undefined,
      pin: '',
    },
  });

  const onSubmit = (data: TransferFormValues) => {
    startTransition(async () => {
      
      if (user.pin_hash !== data.pin) { // MOCK PIN check
         toast({
          variant: 'destructive',
          title: 'PIN Incorrect',
          description: `Le code PIN est incorrect.`,
        });
        return;
      }
      
      const result = await createTransaction({
          user,
          typeCode: 'TR',
          amount: data.amount,
          currency: 'USD',
          description: `Transfert vers ${data.recipientWalletId}`,
          metadata: {
              receiver_wallet_id: data.recipientWalletId
          }
      });

      if (result.success) {
        toast({
            title: 'Transfert réussi !',
            description: `Vous avez envoyé ${data.amount} USD à ${data.recipientWalletId}.`,
        });
        form.reset();
      } else {
        toast({
            variant: 'destructive',
            title: 'Échec du transfert',
            description: result.error,
        });
      }
    });
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Envoyer de l'argent</CardTitle>
        <CardDescription>
          Transférez des fonds instantanément à un autre utilisateur CashPay.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div>
                    <p className="text-sm text-muted-foreground">Votre Wallet ID</p>
                    <p className="text-lg font-semibold">{user.id_wallet}</p>
                </div>
            </div>

            <FormField
              control={form.control}
              name="recipientWalletId"
              render={({ field }) => (
                <FormItem>
                  <InternationalWalletInput
                    field={field}
                    onVerificationResult={() => {}}
                    label="Portefeuille du destinataire"
                    placeholder="Ex: CD1234567890"
                    data-testid="recipient-wallet-id-input"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0.00 USD" {...field} data-testid="amount-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Votre code PIN</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="****" {...field} maxLength={4} data-testid="pin-input" />
                  </FormControl>
                  <FormDescription>
                    Votre code secret à 4 chiffres pour autoriser la transaction.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {isPending ? 'Envoi en cours...' : 'Envoyer'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
