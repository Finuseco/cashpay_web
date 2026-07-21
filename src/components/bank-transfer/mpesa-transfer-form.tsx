
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
import { Loader2, UserCheck } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import type { PayoutDetails } from './bank-transfer-client';
import { verifyMpesaAccountHolder } from '@/services/mpesa';
import { debounce } from 'lodash';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';

const mpesaSchema = z.object({
  amount: z.coerce.number({ required_error: "Le montant est requis." }).min(1, { message: "Le montant minimum est de 1." }),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  recipientPhone: z.string({ required_error: "Le numéro de téléphone est requis." }).min(9, 'Veuillez entrer un numéro de téléphone M-Pesa valide.'),
  recipientName: z.string().optional(),
  pin: z.string({ required_error: "Le PIN est requis." }).length(4, "Le PIN doit contenir 4 chiffres."),
});

interface MpesaTransferFormProps {
    user: User;
    currencies: Currency[];
    onProceed: (details: PayoutDetails & { pin: string }) => void;
}

export function MpesaTransferForm({ user, currencies, onProceed }: MpesaTransferFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifiedName, setVerifiedName] = useState<string | null>(null);
    const [fee, setFee] = useState(0);

    const form = useForm<z.infer<typeof mpesaSchema>>({
        resolver: zodResolver(mpesaSchema),
        defaultValues: { currency: 'USD', amount: undefined, recipientPhone: '', pin: '' }
    });
    
    const recipientPhoneValue = form.watch('recipientPhone');
    const watchedAmount = form.watch("amount");
    const watchedCurrency = form.watch("currency");

    const debouncedVerify = useCallback(debounce(async (phone: string) => {
        if (!phone || phone.length < 9) {
            setVerifiedName(null);
            form.clearErrors('recipientPhone');
            return;
        }
        setIsVerifying(true);
        const result = await verifyMpesaAccountHolder(phone, 'vodacomDRC');
        if (result.success && result.name) {
            setVerifiedName(result.name);
            form.setValue('recipientName', result.name, { shouldValidate: true });
            form.clearErrors('recipientPhone');
        } else {
            setVerifiedName(null);
            form.setError('recipientPhone', { type: 'manual', message: result.error || 'Numéro invalide ou non trouvé.' });
        }
        setIsVerifying(false);
    }, 500), [form]);

    useEffect(() => {
        debouncedVerify(recipientPhoneValue);
        return () => debouncedVerify.cancel();
    }, [recipientPhoneValue, debouncedVerify]);

    useEffect(() => {
      const fetchFee = async () => {
        if(watchedAmount > 0) {
            const calculatedFee = await calculateTransactionFee(watchedAmount, watchedCurrency, 'withdrawal', user.country);
            setFee(calculatedFee);
        } else {
            setFee(0);
        }
      }
      fetchFee();
    }, [watchedAmount, watchedCurrency, user.country]);

    const onSubmit = (values: z.infer<typeof mpesaSchema>) => {
        if (!verifiedName) {
            form.setError('recipientPhone', { type: 'manual', message: 'Veuillez vérifier le numéro avant de continuer.' });
            return;
        }
        onProceed({
            ...values,
            recipientName: verifiedName, // Use the verified name
            fee,
            recipientIdentifier: values.recipientPhone,
            provider: 'mpesa',
        });
    };

    return (
         <Card>
            <CardHeader>
                <CardTitle>M-Pesa</CardTitle>
                <CardDescription>Envoyez directement vers un portefeuille M-Pesa.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{currencies.filter(c => ['USD', 'CDF'].includes(c.code)).map(c => <SelectItem key={c.code} value={c.code}>{c.code} (Solde: {c.balance})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                        </div>
                        <FormField
                            control={form.control}
                            name="recipientPhone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Numéro de téléphone M-Pesa</FormLabel>
                                    <div className="relative">
                                        <FormControl><Input type="tel" {...field} /></FormControl>
                                        {isVerifying && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                       {verifiedName && (
                            <div className="p-3 bg-green-50 text-green-800 rounded-lg space-y-1">
                                <p className="text-xs font-semibold flex items-center gap-2"><UserCheck className="h-4 w-4" />Bénéficiaire Vérifié</p>
                                <p className="font-bold">{verifiedName}</p>
                            </div>
                        )}
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

                        {fee > 0 && <p className="text-sm text-muted-foreground text-center">Frais de transaction: {fee.toFixed(2)} {watchedCurrency}. Total: {(watchedAmount + fee).toFixed(2)} {watchedCurrency}</p>}
                        <Button type="submit" variant="gradient" className="w-full" disabled={isLoading || isVerifying || !verifiedName}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Continuer
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
