'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldCheck, CreditCard, Smartphone, CheckCircle2, UserCheck, Mail, Wallet, KeyRound, ArrowRight, Info, Heart, Target, Tag, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/logo';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { processGatewayCardPayment, processGatewayMobileMoneyPayment, processCashPayAccountPayment } from '@/lib/actions/payment.actions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { PaymentDetails, User } from '@/lib/types';
import { verifyAirtelAccountHolder } from '@/services/airtel';
import { verifyMpesaAccountHolder } from '@/services/mpesa';
import { debounce } from 'lodash';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const cardFormSchema = z.object({
  cardNumber: z.string().min(13, "Numéro de carte invalide.").max(19, "Numéro de carte invalide."),
  cardHolderName: z.string().min(3, "Nom du titulaire requis."),
  expiryDate: z.string().regex(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/, "Date invalide (MM/AA)."),
  cvv: z.string().min(3, "CVV invalide.").max(4, "CVV invalide."),
});

const mobileMoneySchema = z.object({
    operator: z.enum(['airtel', 'mpesa', 'orange', 'mtn']),
    phoneNumber: z.string().min(9, "Numéro de téléphone requis."),
});

const cashpaySchema = z.object({
    pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

interface GatewayPaymentContentProps {
    initialDetails: PaymentDetails & { 
        isPaymentLink?: boolean; 
        isFixed?: boolean; 
        projectImage?: string | null;
        category?: string;
        ownerWalletId?: string;
        status?: string;
    };
    paymentId: number;
    paymentLinkId?: number;
    currentUser: User | null;
}

const operators = [
    { id: 'airtel', name: 'Airtel Money', logo: '/logos/airtel.png' },
    { id: 'mpesa', name: 'M-Pesa', logo: '/logos/mpesa.png' },
    { id: 'orange', name: 'Orange Money', logo: '/logos/orange.png' },
    { id: 'mtn', name: 'MTN MoMo', logo: '/logos/mtn.png' },
];

export function GatewayPaymentContent({ initialDetails, paymentId, paymentLinkId, currentUser }: GatewayPaymentContentProps) {
    const { openAlert } = useAlertDialog();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifiedName, setVerifiedName] = useState<string | null>(null);
    const [customAmount, setCustomAmount] = useState<string>('');
    
    const mmForm = useForm<z.infer<typeof mobileMoneySchema>>({
        resolver: zodResolver(mobileMoneySchema),
        defaultValues: { operator: 'airtel', phoneNumber: '' }
    });

    const cardForm = useForm<z.infer<typeof cardFormSchema>>({
        resolver: zodResolver(cardFormSchema),
    });

    const cashpayForm = useForm<z.infer<typeof cashpaySchema>>({
        resolver: zodResolver(cashpaySchema),
        defaultValues: { pin: '' }
    });

    const currentAmount = initialDetails.isFixed ? initialDetails.amount : parseFloat(customAmount);
    const isBlocked = initialDetails.status === 'blocked';

    const watchPhone = mmForm.watch('phoneNumber');
    const watchOperator = mmForm.watch('operator');

    const debouncedVerify = useCallback(debounce(async (phone: string, operator: string) => {
        if (!phone || phone.length < 9) {
            setVerifiedName(null);
            return;
        }
        setIsVerifying(true);
        let result;
        if (operator === 'airtel') {
            result = await verifyAirtelAccountHolder(phone);
        } else if (operator === 'mpesa') {
            result = await verifyMpesaAccountHolder(phone, 'vodacomDRC');
        } else {
            result = { success: true, name: 'Compte Valide' };
        }
        setVerifiedName(result.success && result.name ? result.name : null);
        setIsVerifying(false);
    }, 600), []);

    useEffect(() => {
        debouncedVerify(watchPhone, watchOperator);
        return () => debouncedVerify.cancel();
    }, [watchPhone, watchOperator, debouncedVerify]);

    const handlePayment = async (type: 'card' | 'momo' | 'cashpay', values: any) => {
        if (isBlocked) {
            openAlert({ title: "Action impossible", description: "Ce lien de paiement a été bloqué.", variant: 'error' });
            return;
        }
        if (isNaN(currentAmount) || currentAmount <= 0) {
            openAlert({ title: "Montant requis", description: "Veuillez saisir un montant valide.", variant: 'warning' });
            return;
        }

        setIsSubmitting(true);
        let result;
        
        if (type === 'cashpay') {
            if (!currentUser) return;
            result = await processCashPayAccountPayment({
                paymentId,
                paymentLinkId,
                userId: currentUser.id,
                amount: currentAmount,
                pin: values.pin
            });
        } else if (type === 'card') {
            result = await processGatewayCardPayment({
                paymentId,
                paymentLinkId,
                amount: currentAmount,
                currency: initialDetails.currency,
                cardDetails: values,
                merchantName: initialDetails.merchantName
            });
        } else {
            result = await processGatewayMobileMoneyPayment({
                ...values,
                paymentId,
                paymentLinkId,
                amount: currentAmount,
                currency: initialDetails.currency,
                merchantName: initialDetails.merchantName
            });
        }

        setIsSubmitting(false);

        if (result.success) {
            openAlert({
                title: 'Paiement Réussi',
                description: `Votre paiement de ${currentAmount} ${initialDetails.currency} a été validé.`,
                variant: 'success',
                onClose: () => {
                    if (initialDetails.redirect_url) window.location.href = initialDetails.redirect_url;
                    else window.location.href = '/dashboard';
                },
            });
            if (type === 'cashpay') cashpayForm.reset();
        } else {
            openAlert({ title: 'Échec du Paiement', description: result.error || "Une erreur est survenue.", variant: 'error' });
        }
    };

    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center p-4 bg-background">
            {initialDetails.isPaymentLink && initialDetails.projectImage && (
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-zinc-200">
                    <Image src={initialDetails.projectImage} alt="Project" fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                </div>
            )}
            
            <Card className="w-full max-w-md shadow-2xl border-primary/10 relative z-10 bg-card">
                <CardHeader className="text-center pb-2">
                    {initialDetails.isPaymentLink ? (
                        <div className="flex flex-col items-center gap-2">
                            <Badge variant="secondary" className="uppercase text-[9px] font-black tracking-widest bg-primary text-white border-none">
                                {initialDetails.category}
                            </Badge>
                            <CardTitle className="text-2xl font-black text-foreground">{initialDetails.merchantName}</CardTitle>
                            <CardDescription className="text-muted-foreground font-medium">Bénéficiaire : <span className="text-primary font-mono">{initialDetails.ownerWalletId}</span></CardDescription>
                        </div>
                    ) : (
                        <>
                            <Logo className="w-32 mx-auto mb-4" />
                            <CardTitle className="text-xl">Passerelle de Paiement</CardTitle>
                            <CardDescription>Paiement sécurisé pour <strong className="text-foreground">{initialDetails.merchantName}</strong></CardDescription>
                        </>
                    )}
                </CardHeader>
                <CardContent className="space-y-6">
                    {isBlocked && (
                        <Alert variant="destructive" className="border-red-600 bg-red-600/10">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertTitle className="font-bold">LIEN BLOQUÉ</AlertTitle>
                            <AlertDescription className="text-xs">
                                Ce lien de paiement a été suspendu pour non-respect de nos conditions de sécurité.
                            </AlertDescription>
                        </Alert>
                    )}

                    {initialDetails.isPaymentLink && !isBlocked && (
                        <div className="text-center p-3 bg-muted/30 rounded-xl border">
                            <p className="text-sm font-semibold text-foreground italic">"{initialDetails.description}"</p>
                        </div>
                    )}

                    {!isBlocked && (
                        <div className="bg-primary/5 rounded-2xl p-6 text-center border border-primary/10 shadow-inner">
                            {initialDetails.isFixed ? (
                                <>
                                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Montant certifié</p>
                                    <p className="text-4xl font-black text-primary mt-1">
                                        {initialDetails.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                                        <span className="text-lg font-normal ml-1">{initialDetails.currency}</span>
                                    </p>
                                </>
                            ) : (
                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Montant personnalisé ({initialDetails.currency})</Label>
                                    <Input 
                                        type="number" 
                                        placeholder="0.00" 
                                        className="h-16 text-4xl font-black text-center border-none bg-transparent focus-visible:ring-0"
                                        value={customAmount}
                                        onChange={(e) => setCustomAmount(e.target.value)}
                                    />
                                    <Separator className="bg-primary/20"/>
                                </div>
                            )}
                        </div>
                    )}

                   {!isBlocked && (
                       <Tabs defaultValue="mobile_money" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 h-12 rounded-xl">
                                <TabsTrigger value="mobile_money" className="text-[10px] uppercase font-bold"><Smartphone className="mr-1.5 h-3.5 w-3.5"/>Mobile</TabsTrigger>
                                <TabsTrigger value="card" className="text-[10px] uppercase font-bold"><CreditCard className="mr-1.5 h-3.5 w-3.5"/>Carte</TabsTrigger>
                                <TabsTrigger value="cashpay" className="text-[10px] uppercase font-bold"><Wallet className="mr-1.5 h-3.5 w-3.5"/>CashPay</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="mobile_money" className="pt-6 animate-in fade-in duration-300">
                                <Form {...mmForm}>
                                    <form onSubmit={mmForm.handleSubmit((v) => handlePayment('momo', v))} className="space-y-6">
                                        <FormField
                                            control={mmForm.control}
                                            name="operator"
                                            render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                    <FormControl>
                                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-4 gap-2">
                                                            {operators.map(op => (
                                                                <div key={op.id}>
                                                                    <RadioGroupItem value={op.id} id={op.id} className="sr-only" />
                                                                    <Label htmlFor={op.id} className={cn(
                                                                        "flex flex-col items-center justify-center p-2 border-2 rounded-xl cursor-pointer transition-all hover:bg-muted aspect-square",
                                                                        field.value === op.id ? "border-primary bg-primary/5" : "border-zinc-100"
                                                                    )}>
                                                                        <Image src={op.logo} alt={op.name} width={30} height={20} className="h-5 object-contain mb-1" />
                                                                        <span className="text-[7px] font-black uppercase text-center leading-none">{op.name.split(' ')[0]}</span>
                                                                    </Label>
                                                                </div>
                                                            ))}
                                                        </RadioGroup>
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={mmForm.control}
                                            name="phoneNumber"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs uppercase font-bold text-zinc-500">Numéro de téléphone</FormLabel>
                                                    <div className="relative">
                                                        <FormControl><Input placeholder="08..." {...field} className="h-12 text-lg font-mono tracking-widest bg-muted/20" /></FormControl>
                                                        {isVerifying && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
                                                    </div>
                                                    {verifiedName && (
                                                        <div className="flex items-center gap-2 p-2 mt-2 rounded-lg bg-green-500/10 text-green-600 text-[10px] font-bold uppercase tracking-wider">
                                                            <UserCheck className="h-4 w-4" /> Compte : {verifiedName}
                                                        </div>
                                                    )}
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl rounded-2xl" disabled={isSubmitting || (['airtel', 'mpesa'].includes(watchOperator) && !verifiedName)}>
                                            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-6 w-6" />}
                                            PAYER MAINTENANT
                                        </Button>
                                    </form>
                                </Form>
                            </TabsContent>
                            
                            <TabsContent value="card" className="pt-6 animate-in fade-in duration-300">
                                <Form {...cardForm}>
                                    <form onSubmit={cardForm.handleSubmit((v) => handlePayment('card', v))} className="space-y-4">
                                        <FormField control={cardForm.control} name="cardHolderName" render={({field}) => (
                                            <FormItem><FormLabel className="text-xs font-bold uppercase">Nom sur la carte</FormLabel><FormControl><Input placeholder="NOM COMPLET" {...field} className="h-11 uppercase" /></FormControl><FormMessage/></FormItem>
                                        )}/>
                                        <FormField control={cardForm.control} name="cardNumber" render={({field}) => (
                                            <FormItem><FormLabel className="text-xs font-bold uppercase">Numéro de carte</FormLabel><FormControl><Input placeholder="0000 0000 0000 0000" {...field} className="h-11 font-mono tracking-widest" /></FormControl><FormMessage/></FormItem>
                                        )}/>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={cardForm.control} name="expiryDate" render={({field}) => (
                                                <FormItem><FormLabel className="text-xs font-bold uppercase">MM/AA</FormLabel><FormControl><Input placeholder="12/26" {...field} className="h-11 font-mono text-center" /></FormControl><FormMessage/></FormItem>
                                            )}/>
                                            <FormField control={cardForm.control} name="cvv" render={({field}) => (
                                                <FormItem><FormLabel className="text-xs font-bold uppercase">CVV</FormLabel><FormControl><Input type="password" placeholder="***" {...field} className="h-11 font-mono text-center" /></FormControl><FormMessage/></FormItem>
                                            )}/>
                                        </div>
                                        <Button type="submit" variant="gradient" className="w-full h-14 font-black shadow-xl rounded-2xl" disabled={isSubmitting}>
                                            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-6 w-6" />}
                                            DÉBITER MA CARTE
                                        </Button>
                                    </form>
                                </Form>
                            </TabsContent>

                            <TabsContent value="cashpay" className="pt-6 animate-in fade-in duration-300">
                                {currentUser ? (
                                    <Form {...cashpayForm}>
                                        <form onSubmit={cashpayForm.handleSubmit((v) => handlePayment('cashpay', v))} className="space-y-6">
                                            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-primary">
                                                    <span>Titulaire</span>
                                                    <span className="font-black">{currentUser.full_name}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-primary">
                                                    <span>Portefeuille</span>
                                                    <span className="font-mono">{currentUser.id_wallet}</span>
                                                </div>
                                            </div>

                                            <FormField
                                                control={cashpayForm.control}
                                                name="pin"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-center block text-xs font-bold uppercase text-zinc-500 mb-4">Code PIN Secret</FormLabel>
                                                        <FormControl>
                                                            <div className="flex justify-center">
                                                                <InputOTP maxLength={4} {...field}>
                                                                    <InputOTPGroup>
                                                                        <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} />
                                                                    </InputOTPGroup>
                                                                </InputOTP>
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-bold shadow-xl rounded-2xl" disabled={isSubmitting || cashpayForm.watch('pin').length < 4}>
                                                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="mr-2 h-6 w-6" />}
                                                CONFIRMER LE TRANSFERT
                                            </Button>
                                        </form>
                                    </Form>
                                ) : (
                                    <div className="text-center py-8 space-y-6">
                                        <p className="text-sm text-muted-foreground font-medium px-4">Payez instantanément et sans frais supplémentaires en utilisant votre compte CashPay All.</p>
                                        <Button asChild variant="outline" className="w-full h-14 border-primary text-primary hover:bg-primary/5 rounded-2xl font-black uppercase text-xs tracking-widest">
                                            <Link href={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>
                                                Se connecter à mon compte <ArrowRight className="ml-2 h-4 w-4"/>
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>
                       </Tabs>
                   )}
                </CardContent>
                <div className="p-4 border-t bg-muted/20 flex justify-center items-center gap-4 grayscale opacity-40">
                    <Image src="/logos/visa.png" alt="Visa" width={40} height={15} />
                    <Image src="/logos/mc.png" alt="Mastercard" width={30} height={20} />
                    <Image src="/logos/pci-dss.png" alt="PCI DSS" width={50} height={20} />
                </div>
            </Card>
            <footer className="mt-8 text-center text-[9px] text-zinc-400 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <ShieldCheck className="h-3 w-3" /> Securized by Sovereign Network
            </footer>
        </main>
    );
}
