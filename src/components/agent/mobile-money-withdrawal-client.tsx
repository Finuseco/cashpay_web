
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserCheck, ShieldCheck, Info, Smartphone } from 'lucide-react';
import Image from 'next/image';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { initiateMobileMoneyCollection } from '@/lib/actions/agent.actions';
import { verifyAirtelAccountHolder } from '@/services/airtel';
import { verifyMpesaAccountHolder } from '@/services/mpesa';
import { validateAccountHolder as validateMtnAccount } from '@/services/mtn';
import { debounce } from 'lodash';
import type { User, Currency } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';


const collectionSchema = z.object({
    operator: z.string({ required_error: 'Veuillez sélectionner un opérateur.' }),
    customerPhone: z.string().min(9, 'Le numéro est requis.'),
    amount: z.coerce.number().positive("Le montant doit être positif."),
    currency: z.string({ required_error: 'La devise est requise.' }),
});

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

const operators = [
    { id: 'airtel', name: 'Airtel Money', logo: '/logos/airtelmoney.png' },
    { id: 'mpesa', name: 'M-Pesa', logo: '/logos/mpesa.png' },
    { id: 'mtn', name: 'MTN MoMo', logo: '/logos/mtn.png' },
    { id: 'orange', name: 'Orange Money', logo: '/logos/orangemoney.png' },
];

export function MobileMoneyWithdrawalClient({ agent, agentCurrencies }: { agent: User | null, agentCurrencies: Currency[] }) {
    const { openAlert } = useAlertDialog();
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifiedName, setVerifiedName] = useState<string | null>(null);
    const [collectionDetails, setCollectionDetails] = useState<z.infer<typeof collectionSchema> | null>(null);

    const form = useForm<z.infer<typeof collectionSchema>>({
        resolver: zodResolver(collectionSchema),
        defaultValues: { operator: 'airtel', currency: 'USD', amount: undefined, customerPhone: '' },
    });

    const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema),
        defaultValues: { pin: "" },
    });
    
    const watchOperator = form.watch('operator');
    const watchPhone = form.watch('customerPhone');

    const debouncedVerify = useCallback(debounce(async (phone: string, operator: string) => {
        if (!phone || phone.length < 9) {
            setVerifiedName(null);
            form.clearErrors('customerPhone');
            return;
        }
        setIsVerifying(true);
        let result;
        switch (operator) {
            case 'airtel': result = await verifyAirtelAccountHolder(phone); break;
            case 'mpesa': result = await verifyMpesaAccountHolder(phone, 'vodacomDRC'); break;
            case 'mtn': result = await validateMtnAccount(phone, 'mtncongo'); break;
            default: result = { success: true, name: 'Utilisateur Mobile Valide' };
        }
        if (result.success && result.name) {
            setVerifiedName(result.name);
            form.clearErrors('customerPhone');
        } else {
            setVerifiedName(null);
            form.setError('customerPhone', { type: 'manual', message: result.error || 'Numéro invalide ou non trouvé.' });
        }
        setIsVerifying(false);
    }, 500), [form]);

    useEffect(() => {
        debouncedVerify(watchPhone, watchOperator);
        return () => debouncedVerify.cancel();
    }, [watchPhone, watchOperator, debouncedVerify]);

    const handleFormSubmit = (values: z.infer<typeof collectionSchema>) => {
        setCollectionDetails(values);
        setIsPinDialogOpen(true);
    };
    
    const handlePinConfirm = async (pinValues: z.infer<typeof pinSchema>) => {
        if (!agent || !collectionDetails) return;
        setIsSubmitting(true);
        
        const result = await initiateMobileMoneyCollection({
            agent,
            agentPin: pinValues.pin,
            operator: collectionDetails.operator,
            customerPhone: collectionDetails.customerPhone,
            amount: collectionDetails.amount,
            currency: collectionDetails.currency
        });
        
        if (result.success) {
            openAlert({ 
                variant: 'success', 
                title: 'Demande Envoyée', 
                description: result.message 
            });
            setIsPinDialogOpen(false);
            form.reset();
            pinForm.reset();
            setVerifiedName(null);
            setCollectionDetails(null);
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
        setIsSubmitting(false);
    };

    if (!agent) {
        return <Loader2 className="animate-spin" />;
    }

    return (
        <>
        <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                 <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><ShieldCheck/> Validation Agent</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Souhaitez-vous encaisser <strong>{collectionDetails?.amount} {collectionDetails?.currency}</strong> depuis le compte {collectionDetails?.operator.toUpperCase()} de <strong>{verifiedName || collectionDetails?.customerPhone}</strong> ?
                    </DialogDescription>
                </DialogHeader>
                <Form {...pinForm}>
                    <form onSubmit={pinForm.handleSubmit(handlePinConfirm)} className="space-y-6 pt-4">
                         <FormField control={pinForm.control} name="pin" render={({ field }) => ( <FormItem><FormLabel className="text-center block">Saisir votre PIN Agent</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage /></FormItem> )} />
                         <DialogFooter className="flex-col sm:flex-row gap-2">
                            <Button type="button" variant="ghost" onClick={() => setIsPinDialogOpen(false)} className="w-full">Annuler</Button>
                            <Button type="submit" variant="gradient" className="w-full h-12 font-bold" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmer l'Encaissement
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>

        <Card className="shadow-lg">
            <CardHeader className="bg-muted/30 border-b">
                <CardTitle>Retrait Cash via Mobile Money</CardTitle>
                <CardDescription>Pour les clients n'ayant pas de compte CashPay. L'argent est prélevé de leur mobile vers votre compte agence.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="operator"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Choisir l'opérateur du client</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="grid grid-cols-4 gap-2"
                                        >
                                            {operators.map(op => (
                                                <FormItem key={op.id}>
                                                    <FormControl>
                                                        <RadioGroupItem value={op.id} id={op.id} className="sr-only" />
                                                    </FormControl>
                                                    <Label htmlFor={op.id} className={cn(
                                                        "flex flex-col items-center justify-center p-2 border-2 rounded-xl cursor-pointer transition-all hover:bg-muted aspect-square",
                                                        field.value === op.id ? "border-primary bg-primary/5" : "border-transparent"
                                                    )}>
                                                        <Image src={op.logo} alt={op.name} width={40} height={20} className="h-6 object-contain mb-1" />
                                                        <span className="text-[8px] font-bold uppercase text-center">{op.name.split(' ')[0]}</span>
                                                    </Label>
                                                </FormItem>
                                            ))}
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="customerPhone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Numéro Mobile du Client</FormLabel>
                                    <div className="relative">
                                        <FormControl><Input type="tel" placeholder="08..." {...field} className="h-12 text-lg" /></FormControl>
                                        {isVerifying && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
                                    </div>
                                    {verifiedName && (
                                        <div className="flex items-center gap-2 p-3 mt-2 rounded-lg bg-green-500/10 text-green-600 text-xs font-bold border border-green-500/20">
                                            <UserCheck className="h-4 w-4"/> Compte Identifié : {verifiedName}
                                        </div>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant du retrait</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} value={field.value || ''} className="h-11 font-bold" /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="currency" render={({ field }) => ( 
                                <FormItem>
                                    <FormLabel>Devise</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="h-11 font-semibold"><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {agentCurrencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem> 
                            )}/>
                        </div>

                         <Alert className="bg-primary/5 border-primary/10">
                            <Info className="h-4 w-4 text-primary" />
                            <AlertTitle className="text-xs font-bold uppercase tracking-tight">Instruction Agent</AlertTitle>
                            <AlertDescription className="text-xs text-muted-foreground">
                                Une fois la demande lancée, le client doit valider le paiement sur son propre téléphone. Ne remettez les espèces qu'une fois votre portefeuille CashPay crédité.
                            </AlertDescription>
                        </Alert>

                        <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl" disabled={isSubmitting || isVerifying || !watchOperator}>
                            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Smartphone className="mr-2" />}
                            INITIER L'ENCAISSEMENT MOBILE
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
        </>
    );
}
