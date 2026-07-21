
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User, Currency } from '@/lib/types';
import { Loader2, Info } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { requestBankDeposit } from '@/lib/actions/bank.actions';

const formSchema = z.object({
  amount: z.coerce.number({ required_error: "Le montant est requis." }).min(10, { message: "Le montant minimum est de 10." }),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  transactionReference: z.string({ required_error: "La référence est requise." }).min(5, { message: "La référence de la transaction est requise." }),
});

export function BankToCashForm({ user, currencies }: { user: User, currencies: Currency[] }) {
    const [isLoading, setIsLoading] = useState(false);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            currency: 'USD',
            amount: undefined,
            transactionReference: ''
        }
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        const result = await requestBankDeposit({ user, ...values });
        setIsLoading(false);

        if (result.success) {
            openAlert({
                variant: 'success',
                title: 'Demande Soumise',
                description: "Votre demande de dépôt a été enregistrée. Les fonds seront crédités après vérification de la transaction."
            });
            form.reset({ currency: 'USD', amount: undefined, transactionReference: '' });
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        Pour déposer des fonds, effectuez un virement vers l'un de nos comptes bancaires, puis utilisez le formulaire ci-dessous avec la référence de votre transaction pour que nous puissions créditer votre portefeuille CashPay.
                    </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
                     <FormField control={form.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="CDF">CDF</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
                </div>
                 <FormField control={form.control} name="transactionReference" render={({ field }) => ( <FormItem><FormLabel>Référence de la transaction bancaire</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <Button type="submit" variant="gradient" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmer le Dépôt
                </Button>
            </form>
        </Form>
    );
}
