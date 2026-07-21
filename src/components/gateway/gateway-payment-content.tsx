
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
    { id: 'airtel', name: 'Airtel Money', logo: '/logos/airtelmoney.png' },
    { id: 'mpesa', name: 'M-Pesa', logo: '/logos/mpesa.png' },
    { id: 'orange', name: 'Orange Money', logo: '/logos/orangemoney.png' },
    { id: 'mtn', name: 'MTN MoMo', logo: '/logos/mtn.png' },
];

export function GatewayPaymentContent({ initialDetails, paymentId, paymentLinkId, currentUser }: GatewayPaymentContentProps) {
    const { openAlert } = useAlertDialog();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifiedName, setVerifiedName] = useState<string | null>(null);
    const [customAmount, setCustomAmount] = useState<number | null>(null);
    
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

    const currentAmount = initialDetails.isFixed ? initialDetails.amount : customAmount;
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
            result = { success: false, error: 'Vérification indisponible' };
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
            openAlert({ title: "Action impossible", description: "Ce lien de paiement a été bloqué par le service de sécurité.", variant: 'error' });
            return;
        }
        if (!currentAmount || currentAmount <= 0) {
            openAlert({ title: "Montant requis", description: "Veuillez saisir un montant avant de payer.", variant: 'warning' });
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
                description: `Votre paiement de ${currentAmount} ${initialDetails.currency} à ${initialDetails.merchantName} a été validé avec succès.`,
                variant: 'success',
                onClose: () => {
                    if (initialDetails.redirect_url) window.location.href = initialDetails.redirect_url;
                },
            });
            if (type === 'cashpay') cashpayForm.reset();
        } else {
            openAlert({ title: 'Échec du Paiement', description: result.error || "Une erreur est survenue.", variant: 'error' });
            if (type === 'cashpay') cashpayForm.reset();
        }
    };

    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-zinc-50 dark:bg-zinc-950">
            {initialDetails.isPaymentLink && initialDetails.projectImage && (
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-zinc-200">
                    <Image src={initialDetails.projectImage} alt="Project" fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                </div>
            )}
            
            <Card className="w-full max-w-md shadow-2xl border-primary/10 relative z-10">
                <CardHeader className="text-center pb-2">
                    {initialDetails.isPaymentLink ? (
                        <div className="flex flex-col items-center gap-2">
                            <Badge variant="secondary" className="uppercase text-[9px] font-black tracking-widest bg-primary text-white border-none">
                                {initialDetails.category}
                            </Badge>
                            <CardTitle className="text-2xl font-black">{initialDetails.merchantName}</CardTitle>
                            <CardDescription className="text-zinc-500 font-medium">Bénéficiaire : <span className="text-primary">{initialDetails.ownerWalletId}</span></CardDescription>
                        </div>
                    ) : (
                        <>
                            <Logo className="w-32 mx-auto mb-4" />
                            <CardTitle className="text-xl">Passerelle de Paiement</CardTitle>
                            <CardDescription>Paiement pour <strong className="text-foreground">{initialDetails.merchantName}</strong></CardDescription>
                        </>
                    )}
                </CardHeader>
                <CardContent className="space-y-6">
                    {isBlocked && (
                        <Alert variant="destructive" className="border-red-600 bg-red-600/10">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertTitle className="font-bold">LIEN BLOQUÉ</AlertTitle>
                            <AlertDescription className="text-xs">
                                Ce lien de paiement a été suspendu par notre service de sécurité pour non-respect de nos conditions.
                            </AlertDescription>
                        </Alert>
                    )}

                    {initialDetails.isPaymentLink && !isBlocked && (
                        <div className="text-center">
                            <p className="text-sm font-bold text-foreground">{initialDetails.description}</p>
                        </div>
                    )}

                    {!isBlocked && (
                        <div className="bg-primary/5 rounded-2xl p-6 text-center border border-primary/10">
                            {initialDetails.isFixed ? (
                                <>
                                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Montant à régler</p>
                                    <p className="text-4xl font-black text-primary mt-1">
                                        {initialDetails.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                                        <span className="text-lg font-normal ml-1">{initialDetails.currency}</span>
                                    </p>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <Label className="text-xs font-bold uppercase text-zinc-500">Choisissez votre montant ({initialDetails.currency})</Label>
                                    <Input 
                                        type="number" 
                                        placeholder="0.00" 
                                        className="h-14 text-3xl font-black text-center border-none bg-transparent"
                                        value={customAmount || ''}
                                        onChange={(e) => setCustomAmount(Number(e.target.value))}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                   {!isBlocked && (
                       <Tabs defaultValue="mobile_money" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 h-12">
                                <TabsTrigger value="mobile_money" className="text-xs"><Smartphone className="mr-1.5 h-3.5 w-3.5"/>Mobile</TabsTrigger>
                                <TabsTrigger value="card" className="text-xs"><CreditCard className="mr-1.5 h-3.5 w-3.5"/>Carte</TabsTrigger>
                                <TabsTrigger value="cashpay" className="text-xs"><Wallet className="mr-1.5 h-3.5 w-3.5"/>CashPay</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="mobile_money" className="pt-6">
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
                                                                        field.value === op.id ? "border-primary bg-primary/5" : "border-transparent"
                                                                    )}>
                                                                        <Image src={op.logo} alt={op.name} width={40} height={20} className="h-6 object-contain mb-1" />
                                                                        <span className="text-[8px] font-bold uppercase text-center">{op.name.split(' ')[0]}</span>
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
                                                    <FormLabel>Numéro Mobile Money</FormLabel>
                                                    <div className="relative">
                                                        <FormControl><Input placeholder="08..." {...field} className="h-12 text-lg" /></FormControl>
                                                        {isVerifying && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
                                                    </div>
                                                    {verifiedName && (
                                                        <div className="flex items-center gap-2 p-2 mt-2 rounded bg-green-500/10 text-green-600 text-xs font-bold">
                                                            <UserCheck className="h-4 w-4" /> Compte : {verifiedName}
                                                        </div>
                                                    )}
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-bold shadow-xl" disabled={isSubmitting || !verifiedName}>
                                            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2" />}
                                            PAYER PAR MOBILE MONEY
                                        </Button>
                                    </form>
                                </Form>
                            </TabsContent>
                            
                            <TabsContent value="card" className="pt-6">
                                <Form {...cardForm}>
                                    <form onSubmit={cardForm.handleSubmit((v) => handlePayment('card', v))} className="space-y-4">
                                        <FormField control={cardForm.control} name="cardHolderName" render={({field}) => (
                                            <FormItem><FormLabel>Nom sur la carte</FormLabel><FormControl><Input placeholder="NOM COMPLET" {...field} className="h-11" /></FormControl><FormMessage/></FormItem>
                                        )}/>
                                        <FormField control={cardForm.control} name="cardNumber" render={({field}) => (
                                            <FormItem><FormLabel>Numéro de carte</FormLabel><FormControl><Input placeholder="0000 0000 0000 0000" {...field} className="h-11 font-mono" /></FormControl><FormMessage/></FormItem>
                                        )}/>
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={cardForm.control} name="expiryDate" render={({field}) => (
                                                <FormItem><FormLabel>MM/AA</FormLabel><FormControl><Input placeholder="12/26" {...field} className="h-11 font-mono" /></FormControl><FormMessage/></FormItem>
                                            )}/>
                                            <FormField control={cardForm.control} name="cvv" render={({field}) => (
                                                <FormItem><FormLabel>CVV</FormLabel><FormControl><Input placeholder="123" {...field} className="h-11 font-mono" /></FormControl><FormMessage/></FormItem>
                                            )}/>
                                        </div>
                                        <Button type="submit" variant="secondary" className="w-full h-14 font-black shadow-lg" disabled={isSubmitting}>
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2" />}
                                            PAYER PAR CARTE
                                        </Button>
                                        <div className="flex items-center gap-2">
                                            <div className="h-px bg-zinc-200 flex-1"></div>
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">ou</span>
                                            <div className="h-px bg-zinc-200 flex-1"></div>
                                        </div>
                                        <Button type="button" variant="outline" className="w-full h-12 flex items-center justify-center gap-2">
                                            <Image src="/logos/paypal.png" alt="PayPal" width={80} height={20} className="object-contain" />
                                        </Button>
                                    </form>
                                </Form>
                            </TabsContent>

                            <TabsContent value="cashpay" className="pt-6">
                                {currentUser ? (
                                    <Form {...cashpayForm}>
                                        <form onSubmit={cashpayForm.handleSubmit((v) => handlePayment('cashpay', v))} className="space-y-6">
                                            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-muted-foreground">Utilisateur</span>
                                                    <span className="font-bold text-primary">{currentUser.full_name}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-muted-foreground">ID Portefeuille</span>
                                                    <span className="font-mono text-primary">{currentUser.id_wallet}</span>
                                                </div>
                                            </div>

                                            <FormField
                                                control={cashpayForm.control}
                                                name="pin"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-center block mb-4">Entrez votre PIN CashPay pour confirmer</FormLabel>
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

                                            <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-bold shadow-xl" disabled={isSubmitting || cashpayForm.watch('pin').length < 4}>
                                                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                                                CONFIRMER LE PAIEMENT
                                            </Button>
                                        </form>
                                    </Form>
                                ) : (
                                    <div className="text-center py-8 space-y-4">
                                        <p className="text-sm text-muted-foreground">Connectez-vous à votre compte CashPay pour un paiement instantané sans frais opérateur.</p>
                                        <Button asChild variant="outline" className="w-full h-12 border-primary text-primary hover:bg-primary/5">
                                            <Link href={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>
                                                Se connecter à CashPay <ArrowRight className="ml-2 h-4 w-4"/>
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </TabsContent>
                       </Tabs>
                   )}
                </CardContent>
                <div className="p-4 border-t bg-muted/30 flex justify-center items-center gap-4 grayscale opacity-50">
                    <Image src="/logos/visa.png" alt="Visa" width={40} height={15} />
                    <Image src="/logos/mc.png" alt="Mastercard" width={30} height={20} />
                    <Image src="/logos/pci-dss.png" alt="PCI DSS" width={50} height={20} />
                </div>
            </Card>
            <footer className="mt-8 text-center text-[10px] text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="h-3 w-3" /> Propulsé par l'infrastructure souveraine CashPay All
            </footer>
        </main>
    );
}
