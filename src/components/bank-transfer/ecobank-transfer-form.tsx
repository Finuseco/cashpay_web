
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User, Currency, Country } from '@/lib/types';
import { Loader2, Landmark } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { generateEcobankAtmToken, processEcobankPayout, processRapidtransfer } from '@/lib/actions/ecobank.actions';
import { getInstitutionList } from '@/services/ecobank';

const atmSchema = z.object({
  amount: z.coerce.number({ required_error: "Le montant est requis." }).min(10, { message: "Le montant minimum est de 10." }),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  recipientPhone: z.string({ required_error: "Le numéro de téléphone du bénéficiaire est requis." }).min(9, 'Veuillez entrer un numéro de téléphone valide.'),
  recipientName: z.string({ required_error: "Le nom du bénéficiaire est requis." }).min(3, "Le nom du bénéficiaire est requis."),
  pin: z.string({ required_error: "Le PIN est requis." }).length(4, "Le PIN doit contenir 4 chiffres."),
});

const payoutSchema = z.object({
  amount: z.coerce.number({ required_error: "Le montant est requis." }).min(1, { message: "Le montant minimum est de 1." }),
  currency: z.string({ required_error: "Veuillez sélectionner une devise." }),
  accountNumber: z.string({ required_error: "Le numéro de compte est requis." }).min(10, 'Veuillez entrer un numéro de compte valide.'),
  recipientName: z.string({ required_error: "Le nom du destinataire est requis." }).min(3, "Le nom du destinataire est requis."),
  pin: z.string({ required_error: "Le PIN est requis." }).length(4, "Le PIN doit contenir 4 chiffres."),
});

const rapidtransferSchema = z.object({
    destinationCountry: z.string({ required_error: "Le pays est requis." }),
    destinationBankCode: z.string({ required_error: "L'institution est requise." }),
    accountNumber: z.string({ required_error: "Le numéro de compte est requis." }).min(5, "Le numéro de compte est requis."),
    recipientName: z.string({ required_error: "Le nom du destinataire est requis." }).min(3, "Le nom du destinataire est requis."),
    amount: z.coerce.number({ required_error: "Le montant est requis." }).min(1, "Le montant est requis."),
    currency: z.string({ required_error: "La devise est requise." }),
    pin: z.string({ required_error: "Le PIN est requis." }).length(4, "Le PIN est requis."),
});

interface EcobankTransferFormProps {
    user: User;
    currencies: Currency[];
    countries: Country[];
}

const RapidtransferForm = ({ user, currencies, countries, onProcess, isSubmitting }: { user: User, currencies: Currency[], countries: Country[], onProcess: (values: any) => void, isSubmitting: boolean }) => {
    const [institutions, setInstitutions] = useState<any[]>([]);
    const [isLoadingInstitutions, setIsLoadingInstitutions] = useState(false);
    
    const form = useForm<z.infer<typeof rapidtransferSchema>>({
        resolver: zodResolver(rapidtransferSchema),
        defaultValues: { currency: 'USD', amount: undefined, accountNumber: '', recipientName: '', destinationCountry: '', destinationBankCode: '', pin: '' }
    });

    const selectedCountry = form.watch('destinationCountry');

    useEffect(() => {
        if (selectedCountry) {
            setIsLoadingInstitutions(true);
            getInstitutionList(selectedCountry).then(result => {
                if (result.success && result.data) {
                    setInstitutions(result.data);
                } else {
                    setInstitutions([]);
                }
                setIsLoadingInstitutions(false);
            });
        }
    }, [selectedCountry]);
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onProcess)} className="space-y-6">
                <FormField control={form.control} name="destinationCountry" render={({ field }) => ( <FormItem><FormLabel>Pays de Destination</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez un pays"/></SelectTrigger></FormControl><SelectContent>{countries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem> )}/>
                <FormField control={form.control} name="destinationBankCode" render={({ field }) => ( <FormItem><FormLabel>Institution de Destination</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingInstitutions || institutions.length === 0}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez une institution"/></SelectTrigger></FormControl><SelectContent>{institutions.map(inst => <SelectItem key={inst.institutionCode} value={inst.institutionCode}>{inst.institutionName}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem> )}/>
                <FormField control={form.control} name="recipientName" render={({ field }) => ( <FormItem><FormLabel>Nom du Bénéficiaire</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem> )}/>
                <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Numéro de Compte</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage/></FormItem> )}/>
                 <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''}/></FormControl><FormMessage/></FormItem> )}/>
                    <FormField control={form.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem> )}/>
                 </div>
                <FormField control={form.control} name="pin" render={({ field }) => (<FormItem><FormLabel>Votre PIN</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage/></FormItem>)}/>
                <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Envoyer</Button>
            </form>
        </Form>
    );
};


export function EcobankTransferForm({ user, currencies, countries }: EcobankTransferFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { openAlert } = useAlertDialog();
    
    const atmForm = useForm<z.infer<typeof atmSchema>>({
        resolver: zodResolver(atmSchema),
        defaultValues: { currency: 'CDF', amount: undefined, recipientPhone: '', recipientName: '', pin: '' }
    });
    
    const payoutForm = useForm<z.infer<typeof payoutSchema>>({
        resolver: zodResolver(payoutSchema),
        defaultValues: { currency: 'USD', amount: undefined, accountNumber: '', recipientName: '', pin: '' }
    });

    const handleAtmSubmit = async (values: z.infer<typeof atmSchema>) => {
        setIsLoading(true);
        const result = await generateEcobankAtmToken({ user, ...values });
        if (result.success && result.code) {
             openAlert({
                variant: 'success',
                title: 'Code de retrait généré !',
                description: `Utilisez le code ${result.code} sur un distributeur Ecobank pour retirer ${values.amount} ${values.currency}. Le code est valable 24h.`
            });
            atmForm.reset({ currency: 'CDF', amount: undefined, recipientPhone: '', pin: '' });
        } else if (result.error) {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
        setIsLoading(false);
    };
    
     const handlePayoutSubmit = async (values: z.infer<typeof payoutSchema>) => {
        setIsLoading(true);
        const result = await processEcobankPayout({ user, ...values, destinationCountry: 'CD' });
        if (result.success && result.transactionId) {
             openAlert({
                variant: 'success',
                title: 'Virement Initié',
                description: `Le virement de ${values.amount} ${values.currency} vers le compte ${values.accountNumber} a été initié avec la référence ${result.transactionId}.`
            });
            payoutForm.reset({ currency: 'USD', amount: undefined, accountNumber: '', recipientName: '', pin: '' });
        } else if (result.error) {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
        setIsLoading(false);
    };
    
    const handleRapidtransferSubmit = async (values: z.infer<typeof rapidtransferSchema>) => {
        setIsLoading(true);
        const result = await processRapidtransfer({ user, ...values });
        if (result.success) {
            openAlert({
                variant: 'success',
                title: 'Virement Rapidtransfer Initié',
                description: `Le virement de ${values.amount} ${values.currency} a été initié avec succès.`
            });
        } else if (result.error) {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
        setIsLoading(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ecobank</CardTitle>
                <CardDescription>Retrait GAB, virement ou transfert international via Rapidtransfer.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="atm" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="atm">Retrait GAB</TabsTrigger>
                    <TabsTrigger value="payout">Virement Compte</TabsTrigger>
                    <TabsTrigger value="rapidtransfer">Rapidtransfer</TabsTrigger>
                  </TabsList>
                  <TabsContent value="atm" className="pt-6">
                    <Form {...atmForm}>
                        <form onSubmit={atmForm.handleSubmit(handleAtmSubmit)} className="space-y-6">
                           <FormField control={atmForm.control} name="recipientName" render={({ field }) => ( <FormItem><FormLabel>Nom du bénéficiaire</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                           <FormField control={atmForm.control} name="recipientPhone" render={({ field }) => ( <FormItem><FormLabel>Téléphone du bénéficiaire</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={atmForm.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={atmForm.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{currencies.filter(c => ['USD','CDF'].includes(c.code)).map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                            </div>
                            <FormField control={atmForm.control} name="pin" render={({ field }) => (<FormItem><FormLabel>Votre PIN</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage/></FormItem>)}/>
                            <Button type="submit" variant="gradient" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Générer le Token</Button>
                        </form>
                    </Form>
                  </TabsContent>
                  <TabsContent value="payout" className="pt-6">
                     <Form {...payoutForm}>
                        <form onSubmit={payoutForm.handleSubmit(handlePayoutSubmit)} className="space-y-6">
                            <FormField control={payoutForm.control} name="recipientName" render={({ field }) => ( <FormItem><FormLabel>Nom du titulaire du compte</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={payoutForm.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Numéro de compte Ecobank</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={payoutForm.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={payoutForm.control} name="currency" render={({ field }) => ( <FormItem><FormLabel>Devise</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{currencies.filter(c => ['USD','CDF', 'EUR'].includes(c.code)).map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                            </div>
                            <FormField control={payoutForm.control} name="pin" render={({ field }) => (<FormItem><FormLabel>Votre PIN</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage/></FormItem>)}/>
                            <Button type="submit" variant="gradient" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Envoyer le Virement</Button>
                        </form>
                    </Form>
                  </TabsContent>
                  <TabsContent value="rapidtransfer" className="pt-6">
                      <RapidtransferForm user={user} currencies={currencies} countries={countries} onProcess={handleRapidtransferSubmit} isSubmitting={isLoading} />
                  </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
