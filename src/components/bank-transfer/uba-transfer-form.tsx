
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User, Currency } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { processUbaPayout } from '@/lib/actions/uba.actions';
import { UBA_BANK_CODE } from '@/lib/constants'; 


const formSchema = z.object({
  amount: z.coerce.number().min(1, "Le montant minimum est de 1."),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  accountNumber: z.string({ required_error: "Le numéro de compte est requis." }).min(10, 'Veuillez entrer un numéro de compte valide.'),
  recipientName: z.string({ required_error: "Le nom du destinataire est requis." }).min(3, "Le nom du destinataire est requis."),
  pin: z.string({ required_error: "Le PIN est requis." }).length(4, "Le PIN doit contenir 4 chiffres."),
});

interface UbaTransferFormProps {
    user: User;
    currencies: Currency[];
}

export function UbaTransferForm({ user, currencies }: UbaTransferFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { currency: 'USD' }
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        const result = await processUbaPayout({
            user,
            ...values,
            destinationBankCode: UBA_BANK_CODE
        });

        if (result.success && result.transactionId) {
             openAlert({
                variant: 'success',
                title: 'Virement Initié',
                description: `Le virement de ${values.amount} ${values.currency} vers le compte ${values.accountNumber} a été initié avec la référence ${result.transactionId}.`
            });
            form.reset({ currency: 'USD', amount: undefined, accountNumber: '', recipientName: '', pin: '' });
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
        setIsLoading(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Virement vers UBA</CardTitle>
                <CardDescription>Envoyez directement vers un compte bancaire UBA.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField control={form.control} name="recipientName" render={({ field }) => ( <FormItem><FormLabel>Nom du titulaire du compte</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Numéro de compte UBA</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{currencies.filter(c => ['USD','CDF', 'EUR'].includes(c.code)).map(c => <SelectItem key={c.code} value={c.code}>{c.code} (Solde: {c.balance})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                        </div>
                        <FormField control={form.control} name="pin" render={({ field }) => (<FormItem><FormLabel>Votre PIN</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage/></FormItem>)}/>
                        <Button type="submit" variant="gradient" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Envoyer le Virement
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
