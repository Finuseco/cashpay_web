
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2, CreditCard, Globe, Building, ShoppingCart, Repeat, Ban, Utensils, Plane, Fuel, Power, SmartphoneNfc, KeyRound, AlertTriangle, ToggleLeft, ToggleRight, Edit2, Info } from 'lucide-react';

import type { Card as CardType } from '@/lib/types';
import type { TransactionControl } from '@/lib/actions/transaction-controls.actions';
import { updateTransactionControls } from '@/lib/actions/transaction-controls.actions';
import { getInAppProvisioningDataAction, setCardPin, toggleCardStatus, terminateCard, updateCardMetadata, activatePhysicalCard } from "@/lib/actions/card.actions";

import { VirtualCard } from '@/components/cards/virtual-card';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const controlsFormSchema = z.object({
  limit_value: z.coerce.number().min(0, "Le plafond doit être un nombre positif."),
  window: z.enum(['TRANSACTION', 'DAY', 'WEEK', 'MONTH']),
});

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
  confirmPin: z.string().length(4, "La confirmation doit contenir 4 chiffres."),
}).refine(data => data.pin === data.confirmPin, {
    message: "Les codes PIN ne correspondent pas.",
    path: ["confirmPin"],
});

const metadataSchema = z.object({
    nickname: z.string().min(2, "Le surnom doit contenir au moins 2 caractères.").max(30, "Trop long."),
});

type TransactionType = 'ECOMMERCE' | 'POS' | 'ATM' | 'RECURRING';

const transactionTypeControls: { id: TransactionType, label: string, icon: React.ElementType }[] = [
    { id: 'ECOMMERCE', label: 'Achats en ligne', icon: Globe },
    { id: 'POS', label: 'Paiements en magasin', icon: ShoppingCart },
    { id: 'ATM', label: 'Retraits au distributeur', icon: Building },
    { id: 'RECURRING', label: 'Paiements récurrents', icon: Repeat },
];

const merchantCategoryControls: { mcc: string, label: string, icon: React.ElementType }[] = [
    { mcc: '5812', label: 'Restaurants', icon: Utensils },
    { mcc: '3000', label: 'Compagnies Aériennes', icon: Plane },
    { mcc: '5541', label: 'Stations-service', icon: Fuel },
    { mcc: '7995', label: 'Jeux d\'argent', icon: Ban },
];

const ApplePayLogo = () => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 fill-current">
        <path d="M12.15,2.52a4.47,4.47,0,0,0-1.8.44,4.24,4.24,0,0,0-1.5,1.24,4.87,4.87,0,0,0-1,2.5,6.23,6.23,0,0,0,1.3,4.3,3.31,3.31,0,0,1,1.13,2.4,5,5,0,0,1-2,4.05,4.85,4.85,0,0,1-2.61,1.4,5.4,5.4,0,0,1-1.39-.14,1.43,1.43,0,0,1,1-1.28,3.22,3.22,0,0,0,1.69-2.9,5.06,5.06,0,0,0-1.61-3.8,6.86,6.86,0,0,1-1.44-5,5.1,5.1,0,0,1,1.86-4,5.33,5.33,0,0,1,3.52-1.53A4.55,4.55,0,0,1,12.15,2.52ZM13.88.79a3.52,3.52,0,0,0-2.47.8,1.43,1.43,0,0,1-1-.41,1.39,1.39,0,0,1-.39-1,3.55,3.55,0,0,0-2.88.58,3.48,3.48,0,0,0-1.64,3,3.13,3.13,0,0,0,1.08,2.26,1.4,1.4,0,0,1-.52,2.08,1.45,1.45,0,0,1-2,0,3.17,3.17,0,0,0-2.51,1.36,3.4,3.4,0,0,0-.73,2.52,7,7,0,0,0,1.34,4.32,5.2,5.2,0,0,0,3.74,2.9,5.64,5.64,0,0,0,4.6-1.12,4.71,4.71,0,0,0,2.15-4,4.86,4.86,0,0,0-2-4.14,1.41,1.41,0,0,1-.22-2.33,1.36,1.36,0,0,1,1.9-.29A6.59,6.59,0,0,0,18,9.75a7.12,7.12,0,0,1,1.13-4.13,3.52,3.52,0,0,0-2.29-3A3.63,3.63,0,0,0,13.88.79Z"/>
    </svg>
);

export function CardDetailClient({ card, initialControls }: { card: CardType, initialControls: TransactionControl[] }) {
    const router = useRouter();
    const { toast } = useToast();
    const { openAlert } = useAlertDialog();
    const [controls, setControls] = useState(initialControls);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localCard, setLocalCard] = useState(card);
    const [isProvisioning, setIsProvisioning] = useState<'google' | 'apple' | null>(null);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [isNicknameDialogOpen, setIsNicknameDialogOpen] = useState(false);

    const form = useForm<z.infer<typeof controlsFormSchema>>({
        resolver: zodResolver(controlsFormSchema),
        defaultValues: {
            limit_value: initialControls.find(c => c.control_type === 'VELOCITY_LIMIT' && c.window === 'TRANSACTION')?.limit_value || 0,
            window: 'TRANSACTION',
        }
    });

    const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema),
        defaultValues: { pin: '', confirmPin: '' },
    });

    const nicknameForm = useForm<z.infer<typeof metadataSchema>>({
        resolver: zodResolver(metadataSchema),
        defaultValues: { nickname: localCard.metadata?.nickname || '' },
    });
    
    const isControlTypeBlocked = (type: TransactionType): boolean => {
        return !!controls.find(c => c.control_type === type && c.is_blocked);
    }

    const isMccBlocked = (mcc: string): boolean => {
        return !!controls.find(c => c.control_type === 'MERCHANT_CATEGORY' && c.mcc === mcc && c.is_blocked);
    }
    
    const handleControlTypeToggle = async (type: TransactionType, block: boolean) => {
        setIsSubmitting(true);
        const result = await updateTransactionControls(localCard.id, [{ control_type: type, is_blocked: block }]);
        if (result.success) {
            setControls(result.controls);
            toast({ title: 'Contrôle mis à jour', description: `Les transactions de type ${type} sont maintenant ${block ? 'bloquées' : 'autorisées'}.`});
        } else {
            toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
        }
        setIsSubmitting(false);
    }
    
    const handleMccToggle = async (mcc: string, block: boolean) => {
        setIsSubmitting(true);
        const result = await updateTransactionControls(localCard.id, [{ control_type: 'MERCHANT_CATEGORY', mcc: mcc, is_blocked: block }]);
        if (result.success) {
            setControls(result.controls);
            toast({ title: 'Catégorie mise à jour', description: `Les paiements pour cette catégorie sont maintenant ${block ? 'bloqués' : 'autorisés'}.`});
        } else {
            toast({ title: 'Erreur', description: result.error, variant: 'destructive' });
        }
        setIsSubmitting(false);
    }

    const onSubmit = async (data: z.infer<typeof controlsFormSchema>) => {
        setIsSubmitting(true);
        const dbResult = await updateTransactionControls(localCard.id, [
            { control_type: 'VELOCITY_LIMIT', limit_value: data.limit_value, window: data.window }
        ]);

        if (dbResult.success) {
            setControls(dbResult.controls);
            toast({ title: 'Plafond mis à jour', description: `Votre plafond de dépense a été configuré.`});
        } else {
            toast({ title: 'Erreur', description: dbResult.error, variant: 'destructive' });
        }
        setIsSubmitting(false);
    }
    
    const handleProvisioning = async (provider: 'google' | 'apple') => {
        setIsProvisioning(provider);
        const result = await getInAppProvisioningDataAction(localCard.id);

        if (result.success && result.data) {
            openAlert({
                title: "Provisionnement Push",
                description: `Les données chiffrées aux couleurs de CashPay ont été générées. L'application mobile peut maintenant finaliser l'ajout à votre ${provider === 'apple' ? 'Apple Wallet' : 'Google Pay'}.`,
                variant: 'success'
            });
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
        setIsProvisioning(null);
    };

    const handlePinChange = async (values: z.infer<typeof pinSchema>) => {
        setIsSubmitting(true);
        const result = await setCardPin(localCard.id, localCard.user_id, values.pin);
        setIsSubmitting(false);

        if (result.success) {
            toast({ title: "PIN mis à jour", description: "Le code PIN de votre carte a été modifié avec succès.", variant: "success" });
            setIsPinDialogOpen(false);
            pinForm.reset();
        } else {
            openAlert({ title: "Erreur", description: result.error || "Impossible de changer le PIN.", variant: 'error' });
        }
    }

    const handleNicknameChange = async (values: z.infer<typeof metadataSchema>) => {
        setIsSubmitting(true);
        const result = await updateCardMetadata(localCard.id, localCard.user_id, values.nickname);
        setIsSubmitting(false);

        if (result.success) {
            setLocalCard(prev => ({ ...prev, metadata: { ...prev.metadata, nickname: values.nickname } }));
            toast({ title: "Surnom mis à jour", description: `La carte s'appelle désormais "${values.nickname}".`, variant: "success" });
            setIsNicknameDialogOpen(false);
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    }

    const handleToggleStatus = async () => {
        const newStatus = localCard.status === 'active' ? 'inactive' : 'active';
        setIsSubmitting(true);
        const result = await toggleCardStatus(localCard.id, newStatus);
        setIsSubmitting(false);

        if (result.success && result.card) {
            setLocalCard(result.card);
            toast({ title: "Statut mis à jour", description: `Votre carte est maintenant ${newStatus === 'active' ? 'activée' : 'suspendue'}.`, variant: "success" });
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
    };

    const handleActivate = async () => {
        setIsSubmitting(true);
        const result = await activatePhysicalCard(localCard.id, localCard.user_id);
        setIsSubmitting(false);

        if (result.success && result.card) {
            setLocalCard(result.card);
            toast({ title: "Carte Activée", description: "Votre carte physique est désormais prête à l'emploi.", variant: "success" });
        } else {
            openAlert({ title: "Erreur d'activation", description: result.error, variant: 'error' });
        }
    };

    const handleTerminate = () => {
        openAlert({
            title: "Résilier la carte ?",
            description: "Cette action est irréversible. Votre carte physique ou virtuelle sera définitivement désactivée.",
            variant: "destructive",
            showCancel: true,
            confirmText: "Résilier définitivement",
            onClose: async (confirmed) => {
                if (confirmed) {
                    setIsSubmitting(true);
                    const result = await terminateCard(localCard.id, localCard.user_id);
                    setIsSubmitting(false);
                    if (result.success) {
                        toast({ title: "Carte résiliée", description: "Votre carte a été fermée avec succès." });
                        router.push('/cards');
                    } else {
                        openAlert({ title: "Erreur", description: result.error, variant: 'error' });
                    }
                }
            }
        });
    };

    const isInactive = localCard.status === 'inactive';
    const isSuspended = localCard.status === 'suspended' || localCard.status === 'pending_cancellation';

    return (
        <div className="space-y-6">
            {/* PIN Dialog */}
            <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Changer le Code PIN de la Carte</DialogTitle>
                        <DialogDescription>Définissez un nouveau code PIN à 4 chiffres pour vos retraits et paiements physiques.</DialogDescription>
                    </DialogHeader>
                    <Form {...pinForm}>
                        <form onSubmit={pinForm.handleSubmit(handlePinChange)} className="space-y-6 pt-4">
                            <FormField control={pinForm.control} name="pin" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nouveau PIN</FormLabel>
                                    <FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={pinForm.control} name="confirmPin" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirmer le PIN</FormLabel>
                                    <FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Mettre à jour le PIN
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Nickname Dialog */}
            <Dialog open={isNicknameDialogOpen} onOpenChange={setIsNicknameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Surnom de la carte</DialogTitle>
                        <DialogDescription>Donnez un nom personnalisé à cette carte (ex: Voyages, Courses...).</DialogDescription>
                    </DialogHeader>
                    <Form {...nicknameForm}>
                        <form onSubmit={nicknameForm.handleSubmit(handleNicknameChange)} className="space-y-4 pt-4">
                            <FormField control={nicknameForm.control} name="nickname" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Surnom</FormLabel>
                                    <FormControl><Input placeholder="Ma carte Voyages" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Enregistrer
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.push('/cards')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-foreground">
                            {localCard.metadata?.nickname || `${localCard.brand.toUpperCase()} •••• ${localCard.last4}`}
                        </h1>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsNicknameDialogOpen(true)}>
                            <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                    <p className="text-muted-foreground">Gérez votre carte souveraine CashPay.</p>
                </div>
                <Badge className={cn("px-3 py-1", isInactive ? "bg-amber-500" : isSuspended ? "bg-orange-500" : "bg-green-500")}>
                    {isInactive ? "Inactive" : isSuspended ? "Suspendue" : "Active"}
                </Badge>
            </div>

            {isInactive && (
                <Alert className="bg-amber-50 border-amber-200">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 font-bold">Activation Requise</AlertTitle>
                    <AlertDescription className="text-amber-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <span>Vous avez reçu votre carte physique ? Activez-la maintenant pour commencer à l'utiliser.</span>
                        <Button onClick={handleActivate} disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Activer ma carte
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-6 items-start">
                 <VirtualCard card={localCard} balance={localCard.balance.toString()} symbol={localCard.currency === 'USD' ? '$' : '€'} />

                 <Card>
                    <CardHeader>
                        <CardTitle>Sécurité & PIN</CardTitle>
                        <CardDescription>Gérez l'accès et les autorisations de votre carte.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button variant="outline" className="w-full justify-start" onClick={handleToggleStatus} disabled={isSubmitting || isInactive}>
                            {localCard.status === 'active' ? <ToggleLeft className="mr-2 h-4 w-4 text-orange-500" /> : <ToggleRight className="mr-2 h-4 w-4 text-green-500" />}
                            {localCard.status === 'active' ? "Suspendre temporairement" : "Réactiver la carte"}
                        </Button>
                        <Button variant="outline" className="w-full justify-start" onClick={() => setIsPinDialogOpen(true)} disabled={isSubmitting || isInactive}>
                            <KeyRound className="mr-2 h-4 w-4"/> Modifier le code PIN
                        </Button>
                        <Separator className="my-2"/>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Types de transactions</p>
                        {transactionTypeControls.map(control => (
                            <div key={control.id} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                                <div className="flex items-center gap-3">
                                    <control.icon className="h-5 w-5 text-muted-foreground" />
                                    <Label htmlFor={`switch-${control.id}`} className="font-semibold text-sm">{control.label}</Label>
                                </div>
                                <Switch
                                    id={`switch-${control.id}`}
                                    checked={!isControlTypeBlocked(control.id)}
                                    onCheckedChange={(checked) => handleControlTypeToggle(control.id, !checked)}
                                    disabled={isSubmitting || isInactive || isSuspended}
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
            
             <Card className={cn((isInactive || isSuspended) && "opacity-50 pointer-events-none")}>
                <CardHeader>
                    <CardTitle>Plafonds de Dépenses</CardTitle>
                    <CardDescription>Définissez des limites matérielles pour un contrôle total.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-2 items-end">
                                <FormField
                                    control={form.control}
                                    name="limit_value"
                                    render={({ field }) => (
                                        <FormItem className="flex-grow">
                                            <FormLabel>Plafond ({localCard.currency})</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormDescription>Mettez 0 pour aucune limite.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="window"
                                    render={({ field }) => (
                                        <FormItem className="w-full sm:w-48">
                                            <FormLabel>Période</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="TRANSACTION">Par Transaction</SelectItem>
                                                    <SelectItem value="DAY">Par Jour</SelectItem>
                                                    <SelectItem value="WEEK">Par Semaine</SelectItem>
                                                    <SelectItem value="MONTH">Par Mois</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                <Save className="mr-2 h-4 w-4"/>
                                Sauvegarder les limites
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <SmartphoneNfc className="text-primary" /> Portefeuilles Mobiles (Push Provisioning)
                    </CardTitle>
                    <CardDescription>Ajoutez votre carte à votre téléphone. Votre identité CashPay sera affichée dans le portefeuille mobile.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-2">
                    <Button className="w-full sm:w-auto bg-black hover:bg-black/80 text-white flex items-center justify-center gap-2" onClick={() => handleProvisioning('google')} disabled={!!isProvisioning || isInactive || isSuspended}>
                        {isProvisioning === 'google' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        <span>Add to </span> <span className="font-bold">Google Pay</span>
                    </Button>
                     <Button className="w-full sm:w-auto bg-black hover:bg-black/80 text-white flex items-center justify-center gap-2" onClick={() => handleProvisioning('apple')} disabled={!!isProvisioning || isInactive || isSuspended}>
                         {isProvisioning === 'apple' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ApplePayLogo />}
                         <span>Add to </span> <span className="font-bold">Apple Wallet</span>
                    </Button>
                </CardContent>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle/> Zone Critique</CardTitle>
                    <CardDescription>Actions de dernier recours pour la sécurité de vos fonds.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 border border-destructive/20 rounded-lg bg-background">
                        <div>
                            <p className="font-bold text-sm">Déclarer Perdue ou Volée</p>
                            <p className="text-xs text-muted-foreground">La carte sera immédiatement annulée et une nouvelle sera commandée.</p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => handleTerminate()} disabled={isSubmitting}>Résilier</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
