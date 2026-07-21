
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
import { Loader2, Info } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { requestBankWithdrawal, requestBankDeposit } from '@/lib/actions/bank.actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const withdrawalSchema = z.object({
  amount: z.coerce.number({ required_error: "Le montant est requis." }).min(1, { message: "Le montant minimum est de 1." }),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  recipientIdentifier: z.string({ required_error: "Le numéro de carte ou de téléphone est requis." }).min(10, { message: "Veuillez entrer un numéro de carte ou de téléphone valide." }),
  recipientName: z.string({ required_error: "Le nom du bénéficiaire est requis." }).min(3, "Le nom du bénéficiaire est requis."),
});

const depositSchema = z.object({
  amount: z.coerce.number().min(1, { message: "Le montant est requis." }),
  currency: z.string().default('RUB'),
  transactionReference: z.string().min(5, { message: "La référence de la transaction est requise." }),
  operator: z.string().default('wallet131') // Add this hidden field
});


export function CashToWallet131Form({ user, currencies }: { user: User, currencies: Currency[] }) {
    const [isLoading, setIsLoading] = useState(false);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof withdrawalSchema>>({
        resolver: zodResolver(withdrawalSchema),
        defaultValues: { currency: 'USD', recipientName: '', amount: undefined, recipientIdentifier: '' }
    });

    const onSubmit = async (values: z.infer<typeof withdrawalSchema>) => {
        setIsLoading(true);
        const result = await requestBankWithdrawal({ 
            user, 
            ...values,
            bankName: 'Wallet 131',
            accountHolderName: values.recipientName,
            iban: values.recipientIdentifier,
            swift: 'W131',
        });
        setIsLoading(false);

        if (result.success) {
            openAlert({
                variant: 'success', title: 'Demande Soumise',
                description: "Votre demande de retrait vers Wallet 131 a été envoyée. Vous serez notifié une fois le virement effectué."
            });
            form.reset({ currency: 'USD', amount: undefined, recipientIdentifier: '', recipientName: '' });
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Wallet 131</CardTitle>
                <CardDescription>Transférez des fonds vers la Russie.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Comment ça marche ?</AlertTitle>
                            <AlertDescription>
                                Entrez les détails du bénéficiaire en Russie. Les fonds seront envoyés depuis votre portefeuille CashPay vers leur carte bancaire ou portefeuille via notre partenaire Wallet 131.
                            </AlertDescription>
                        </Alert>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant à envoyer</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code} (Solde: {c.balance})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                        </div>
                        <FormField control={form.control} name="recipientName" render={({ field }) => ( <FormItem><FormLabel>Nom complet du bénéficiaire</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="recipientIdentifier" render={({ field }) => ( <FormItem><FormLabel>N° de carte ou de téléphone du bénéficiaire</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <Button type="submit" variant="gradient" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Retrait
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
