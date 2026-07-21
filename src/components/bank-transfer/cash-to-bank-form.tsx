
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
import { requestBankWithdrawal } from '@/lib/actions/bank.actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';


const formSchema = z.object({
  amount: z.coerce.number({ required_error: "Le montant est requis." }).min(10, { message: "Le montant minimum est de 10." }),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  bankName: z.string({ required_error: "Le nom de la banque est requis." }).min(3, "Le nom de la banque est requis."),
  accountHolderName: z.string({ required_error: "Le nom du titulaire est requis." }).min(3, "Le nom du titulaire est requis."),
  iban: z.string({ required_error: "L'IBAN/Numéro de compte est requis." }).min(10, "L'IBAN/Numéro de compte est requis."),
  swift: z.string().optional(),
  reason: z.string().optional(),
});

interface CashToBankFormProps {
    user: User;
    currencies: Currency[];
    bankName?: string;
}

export function CashToBankForm({ user, currencies, bankName }: CashToBankFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            accountHolderName: user.full_name,
            currency: 'USD',
            bankName: bankName || '',
            amount: undefined,
            iban: '',
            swift: '',
            reason: '',
        }
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        const result = await requestBankWithdrawal({ user, ...values });
        setIsLoading(false);

        if (result.success) {
            openAlert({
                variant: 'success',
                title: 'Demande Soumise',
                description: "Votre demande de retrait a été envoyée. Vous serez notifié une fois le virement effectué."
            });
            form.reset({ currency: 'USD', amount: undefined, bankName: bankName || '', accountHolderName: user.full_name, iban: '', swift: '', reason: ''});
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
    };

    return (
         <Card>
            <CardHeader>
                <CardTitle>Virement vers {bankName || 'une banque'}</CardTitle>
                <CardDescription>Remplissez les détails du compte bancaire de destination.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {!bankName?.toLowerCase().includes('equity') && (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                    Les virements vers cette banque sont traités manuellement et peuvent prendre jusqu'à 48 heures.
                                </AlertDescription>
                            </Alert>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code} (Solde: {c.balance})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                        </div>
                        <FormField control={form.control} name="bankName" render={({ field }) => ( <FormItem><FormLabel>Nom de la Banque</FormLabel><FormControl><Input {...field} readOnly={!!bankName} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="accountHolderName" render={({ field }) => ( <FormItem><FormLabel>Nom du Titulaire du Compte</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="iban" render={({ field }) => ( <FormItem><FormLabel>IBAN / Numéro de Compte</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="swift" render={({ field }) => ( <FormItem><FormLabel>Code SWIFT/BIC (Optionnel)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="reason" render={({ field }) => ( <FormItem><FormLabel>Motif du virement (Optionnel)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )}/>
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
