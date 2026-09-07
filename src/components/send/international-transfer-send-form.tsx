
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, ShieldCheck, Mail, Smartphone, Check, Globe } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { User, Currency, Country } from "@/lib/types";
import { requestInternationalTransfer, requestPayPalPayout } from '@/lib/actions/payouts.actions';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';
import { africanCountries } from '@/lib/payment-methods';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const formSchema = z.object({
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Montant positif requis."),
  paymentCurrency: z.string(),
  recipient: z.string().min(5, "Destinataire requis (Email ou Téléphone)."),
  pin: z.string().length(4, "PIN à 4 chiffres."),
});

export function InternationalTransferSendForm({ user, currencies, provider, onBack }: { user: User, currencies: Currency[], provider: 'mobile_money' | 'paypal', onBack: () => void }) {
    const { openAlert } = useAlertDialog();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState('');
    const [fee, setFee] = useState(0);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { paymentCurrency: 'USD', amount: '', recipient: '', pin: '' }
    });

    const watchAmount = form.watch('amount');
    const watchCurrency = form.watch('paymentCurrency');

    useEffect(() => {
        if (watchAmount && parseFloat(watchAmount) > 0) {
            calculateTransactionFee(parseFloat(watchAmount), watchCurrency, provider === 'paypal' ? 'WD_PAYPAL' : 'WD_MOMO', user.country)
                .then(setFee);
        }
    }, [watchAmount, watchCurrency, provider, user.country]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        let result;
        
        if (provider === 'paypal') {
            result = await requestPayPalPayout({
                user, email: values.recipient, amount: parseFloat(values.amount),
                currency: values.paymentCurrency, pin: values.pin
            });
        } else {
            const [countryCode, operator] = selectedMethod.split(':');
            result = await requestInternationalTransfer({
                user, provider: 'mobile_money', recipientName: 'Client Mobile',
                recipientCountry: countryCode, recipientPhone: values.recipient,
                amount: parseFloat(values.amount), currency: values.paymentCurrency,
                fee: fee, notifyRecipientSms: true, mobileMoneyOperator: operator as any
            });
        }

        setIsLoading(false);
        if (result.success) {
            openAlert({ title: 'Succès', description: 'Votre transfert a été initié avec succès.', variant: 'success', onClose: onBack });
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="text-center px-0">
                <Button variant="ghost" size="icon" className="absolute top-3 left-3" onClick={onBack}><ArrowLeft/></Button>
                <CardTitle className="text-2xl font-black uppercase">{provider === 'paypal' ? 'Transfert PayPal' : 'Mobile Money Afrique'}</CardTitle>
                <CardDescription>Envoyez des fonds directement sur un compte {provider === 'paypal' ? 'PayPal' : 'mobile'}.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 space-y-6">
                {provider === 'mobile_money' && !selectedMethod ? (
                    <div className="space-y-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center">Sélecteur de destination</p>
                        <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-1">
                            {africanCountries.map(country => (
                                <div key={country.code} className="space-y-2">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase pl-1">{country.flag} {country.name}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {country.methods.map(op => (
                                            <Button key={op} variant="outline" className="h-12 justify-start font-bold text-xs" onClick={() => setSelectedMethod(`${country.code}:${op.toLowerCase()}`)}>
                                                {op}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {selectedMethod && (
                                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/10">
                                    <p className="text-xs font-bold uppercase text-primary">{selectedMethod.split(':')[1]}</p>
                                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setSelectedMethod('')}>Changer</Button>
                                </div>
                            )}

                            <div className="space-y-3">
                                <FormLabel>Payer avec le portefeuille</FormLabel>
                                <FormField control={form.control} name="paymentCurrency" render={({ field }) => (
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-2">
                                        {currencies.map(c => (
                                            <div key={c.code}>
                                                <RadioGroupItem value={c.code} id={`w-${c.code}`} className="sr-only" />
                                                <Label htmlFor={`w-${c.code}`} className={cn("flex flex-col p-3 border-2 rounded-xl cursor-pointer transition-all hover:bg-muted", field.value === c.code ? "border-primary bg-primary/5" : "border-zinc-100")}>
                                                    <span className="font-bold text-sm">{c.code}</span>
                                                    <span className="text-[10px] opacity-60">{c.balance}</span>
                                                </Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                )}/>
                            </div>

                            <FormField control={form.control} name="recipient" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{provider === 'paypal' ? 'Email PayPal du destinataire' : 'Numéro de téléphone mobile'}</FormLabel>
                                    <FormControl><Input placeholder={provider === 'paypal' ? 'exemple@email.com' : '00...'} {...field} className="h-12" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>

                            <FormField control={form.control} name="amount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Montant à envoyer ({watchCurrency})</FormLabel>
                                    <FormControl><Input type="number" step="any" placeholder="0.00" {...field} className="h-14 text-2xl font-black text-center" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>

                            <div className="p-4 bg-muted/50 rounded-2xl border border-dashed text-center">
                                <p className="text-sm">Frais : <strong>{fee.toFixed(2)} {watchCurrency}</strong></p>
                                <p className="text-lg font-black text-primary">Total débité : {(parseFloat(watchAmount || '0') + fee).toFixed(2)} {watchCurrency}</p>
                            </div>

                            <FormField control={form.control} name="pin" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-center block text-xs font-bold uppercase text-muted-foreground">Saisir votre PIN CashPay</FormLabel>
                                    <FormControl>
                                        <div className="flex justify-center pt-2">
                                            <InputOTP maxLength={4} {...field}>
                                                <InputOTPGroup>
                                                    <InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/>
                                                </InputOTPGroup>
                                            </InputOTP>
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )}/>

                            <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl" disabled={isLoading || form.watch('pin').length < 4}>
                                {isLoading ? <Loader2 className="animate-spin mr-2"/> : <ShieldCheck className="mr-2"/>} CONFIRMER L'ENVOI
                            </Button>
                        </form>
                    </Form>
                )}
            </CardContent>
        </Card>
    );
}
