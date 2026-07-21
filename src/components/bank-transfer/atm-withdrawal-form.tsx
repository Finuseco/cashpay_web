
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
import { Loader2, Landmark } from 'lucide-react';
import { useState } from 'react';
import { generateAirtelAtmWithdrawalCode } from '@/lib/actions/bank.actions';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const formSchema = z.object({
  amount: z.coerce.number().min(10, { message: "Le montant minimum est de 10." }),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  pin: z.string().length(4, { message: "Le PIN doit comporter 4 chiffres." }),
});


export function AtmWithdrawalForm({ user, currencies }: { user: User, currencies: Currency[] }) {
    const [isLoading, setIsLoading] = useState(false);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { currency: 'CDF' }
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        const result = await generateAirtelAtmWithdrawalCode({
            user,
            amount: values.amount,
            currency: values.currency as 'USD' | 'CDF',
            pin: values.pin,
        });
        
        if (result.success && result.code) {
             openAlert({
                variant: 'success',
                title: 'Code de retrait généré !',
                description: `Utilisez le code ${result.code} sur un distributeur Airtel pour retirer ${values.amount} ${values.currency}. Le code est valable 24h.`
            });
            form.reset({ currency: 'CDF', amount: undefined, pin: '' });
        } else if (result.error) {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
        setIsLoading(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Retrait GAB</CardTitle>
                <CardDescription>Générez un code pour un retrait sans carte.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{currencies.filter(c => ['USD','CDF'].includes(c.code)).map(c => <SelectItem key={c.code} value={c.code}>{c.code} (Solde: {c.balance})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                        </div>
                        <FormField
                            control={form.control}
                            name="pin"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Votre PIN de sécurité</FormLabel>
                                <FormControl>
                                    <div className="flex justify-center">
                                    <InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP>
                                    </div>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" variant="gradient" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Retrait
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
