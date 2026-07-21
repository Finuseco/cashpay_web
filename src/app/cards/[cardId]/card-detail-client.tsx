
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
    ArrowLeft, Save, Loader2, CreditCard, Globe, Building, 
    ShoppingCart, Repeat, Ban, Utensils, Plane, Fuel, Power, 
    SmartphoneNfc, KeyRound, AlertTriangle, ToggleLeft, ToggleRight, 
    Edit2, Info, Link as LinkIcon, Unlink, Usb, ShieldCheck, Wallet, 
    FileArchive, RefreshCw, Smartphone, Plus
} from 'lucide-react';

import type { Card as CardType, HardwareKeyInfo } from '@/lib/types';
import type { TransactionControl } from '@/lib/actions/transaction-controls.actions';
import { updateTransactionControls } from '@/lib/actions/transaction-controls.actions';
import { 
    getInAppProvisioningDataAction, setCardPin, toggleCardStatus, 
    terminateCard, updateCardMetadata, activatePhysicalCard,
    updateSpendingSource, linkCpkToCard, unlinkCpkFromCard
} from "@/lib/actions/card.actions";

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

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

const linkCpkSchema = z.object({
    signature: z.string().min(64, "La signature H est requise (64 caractères)."),
    pin: z.string().length(4, "Le PIN de la clé est requis."),
});

type TransactionType = 'ECOMMERCE' | 'POS' | 'ATM' | 'RECURRING';

const transactionTypeControls: { id: TransactionType, label: string, icon: React.ElementType }[] = [
    { id: 'ECOMMERCE', label: 'Achats en ligne', icon: Globe },
    { id: 'POS', label: 'Paiements en magasin', icon: ShoppingCart },
    { id: 'ATM', label: 'Retraits au distributeur', icon: Building },
    { id: 'RECURRING', label: 'Paiements récurrents', icon: Repeat },
];

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
    const [isLinkCpkOpen, setIsLinkCpkOpen] = useState(false);

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

    const linkCpkForm = useForm<z.infer<typeof linkCpkSchema>>({
        resolver: zodResolver(linkCpkSchema),
        defaultValues: { signature: '', pin: '' },
    });
    
    const isControlTypeBlocked = (type: TransactionType): boolean => {
        return !!controls.find(c => c.control_type === type && c.is_blocked);
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

    const handleUpdateSource = async (type: 'wallet' | 'cpk') => {
        setIsSubmitting(true);
        const result = await updateSpendingSource(localCard.id, type);
        setIsSubmitting(false);

        if (result.success) {
            setLocalCard(prev => ({ ...prev, spending_source_type: type }));
            toast({ title: "Source de financement mise à jour", description: `La carte utilise désormais le ${type === 'wallet' ? 'portefeuille' : 'certificat USB'}.` });
        }
    };

    const handleLinkCpk = async (values: z.infer<typeof linkCpkSchema>) => {
        setIsSubmitting(true);
        const result = await linkCpkToCard(localCard.id, values.signature, values.pin);
        setIsSubmitting(false);

        if (result.success) {
            toast({ title: "Certificat Lié avec succès", variant: "success" });
            setIsLinkCpkOpen(false);
            window.location.reload(); 
        } else {
            openAlert({ title: "Erreur de liaison", description: result.error, variant: 'error' });
        }
    };

    const handleUnlinkCpk = async () => {
        setIsSubmitting(true);
        const result = await unlinkCpkFromCard(localCard.id);
        setIsSubmitting(false);

        if (result.success) {
            toast({ title: "Certificat Délié", variant: "info" });
            window.location.reload();
        }
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

            <Dialog open={isLinkCpkOpen} onOpenChange={setIsLinkCpkOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Lier un nouveau Coffre USB (.CPK)</DialogTitle>
                        <DialogDescription>
                            Connectez un certificat externe à votre carte. Le propriétaire original doit autoriser cette action via le code PIN de la clé.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...linkCpkForm}>
                        <form onSubmit={linkCpkForm.handleSubmit(handleLinkCpk)} className="space-y-4 pt-4">
                            <FormField control={linkCpkForm.control} name="signature" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Signature H du Certificat</FormLabel>
                                    <FormControl><Input placeholder="Collez la signature de 64 caractères..." {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={linkCpkForm.control} name="pin" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Code PIN du Certificat</FormLabel>
                                    <FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <DialogFooter>
                                <Button type="submit" className="w-full" variant="gradient" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <ShieldCheck className="h-4 w-4 mr-2"/>}
                                    Valider l'Inter-Connexion
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
                    </div>
                    <p className="text-muted-foreground">Gestion de votre carte souveraine CashPay.</p>
                </div>
                <Badge className={cn("px-3 py-1", isInactive ? "bg-amber-500" : isSuspended ? "bg-orange-500" : "bg-green-500")}>
                    {isInactive ? "Inactive" : isSuspended ? "Suspendue" : "Active"}
                </Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-6 items-start">
                 <VirtualCard card={localCard} balance={localCard.balance.toString()} symbol={localCard.currency === 'USD' ? '$' : '€'} />

                 <Card>
                    <CardHeader>
                        <CardTitle>Source de financement</CardTitle>
                        <CardDescription>Choisissez l'origine prioritaire des fonds.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <RadioGroup 
                            value={localCard.spending_source_type} 
                            onValueChange={(val) => handleUpdateSource(val as any)}
                            className="grid grid-cols-1 gap-3"
                        >
                            <div className={cn(
                                "flex items-center justify-between p-4 border rounded-xl transition-all cursor-pointer",
                                localCard.spending_source_type === 'wallet' ? "border-primary bg-primary/5 shadow-inner" : "hover:bg-muted"
                            )} onClick={() => handleUpdateSource('wallet')}>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Wallet className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">Portefeuille CashPay</p>
                                        <p className="text-[10px] text-zinc-500 uppercase font-black">Souveraineté Standard</p>
                                    </div>
                                </div>
                                <div className={cn("h-4 w-4 rounded-full border-2", localCard.spending_source_type === 'wallet' ? "border-primary bg-primary" : "border-zinc-300")} />
                            </div>

                            <div className={cn(
                                "flex items-center justify-between p-4 border rounded-xl transition-all cursor-pointer",
                                localCard.spending_source_type === 'cpk' ? "border-primary bg-primary/5 shadow-inner" : "hover:bg-muted"
                            )} onClick={() => handleUpdateSource('cpk')}>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Usb className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm">Hardware Vault (USB)</p>
                                        <p className="text-[10px] text-zinc-500 uppercase font-black">
                                            {localCard.linkedKeys && localCard.linkedKeys.length > 0 ? `${localCard.linkedKeys.length} Certificat(s) Lié(s)` : 'Aucune clé active'}
                                        </p>
                                    </div>
                                </div>
                                <div className={cn("h-4 w-4 rounded-full border-2", localCard.spending_source_type === 'cpk' ? "border-primary bg-primary" : "border-zinc-300")} />
                            </div>
                        </RadioGroup>
                    </CardContent>
                </Card>
            </div>

            {/* Hardware Sources List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Usb className="h-5 w-5 text-primary"/> Gestion des Coffres USB</CardTitle>
                        <CardDescription>Gérez vos certificats de valeur matérielle liés à cette carte.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsLinkCpkOpen(true)} className="font-bold">
                        <Plus className="mr-2 h-4 w-4"/> Lier une clé
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableBody>
                            {localCard.linkedKeys && localCard.linkedKeys.length > 0 ? localCard.linkedKeys.map(key => (
                                <TableRow key={key.signature} className="border-t">
                                    <TableCell className="text-xs">
                                        <p className="font-bold font-mono">#{key.reference.split('-')[1]}</p>
                                        <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{key.signature}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-black text-primary">{key.amount.toFixed(2)} {key.currency}</p>
                                        <Badge className={cn(
                                            "text-[8px] uppercase font-black",
                                            key.status === 'active' ? "bg-green-500" : "bg-red-500"
                                        )}>
                                            {key.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleUnlinkCpk}>
                                            <Unlink className="h-4 w-4"/>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic text-xs">
                                        Aucun certificat de valeur USB lié à cette carte.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Contrôles de Sécurité</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button variant="outline" className="w-full justify-start" onClick={handleToggleStatus} disabled={isSubmitting}>
                        {localCard.status === 'active' ? <ToggleLeft className="mr-2 h-4 w-4 text-orange-500" /> : <ToggleRight className="mr-2 h-4 w-4 text-green-500" />}
                        {localCard.status === 'active' ? "Suspendre temporairement" : "Réactiver la carte"}
                    </Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => setIsPinDialogOpen(true)} disabled={isSubmitting}>
                        <KeyRound className="mr-2 h-4 w-4"/> Modifier le code PIN
                    </Button>
                    <Separator className="my-2"/>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Types de transactions autorisées</p>
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
                                disabled={isSubmitting}
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle/> Zone Critique</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button variant="destructive" className="w-full font-bold" onClick={() => handleTerminate()} disabled={isSubmitting}>Résilier la carte définitivement</Button>
                </CardContent>
            </Card>
        </div>
    );
}
