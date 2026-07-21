
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, Briefcase, Loader2, Info, ShieldCheck, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getAgentSubscription, subscribeAsAgent, setAutoRenew, type AgentSubscription } from '@/lib/actions/agent-application.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Switch } from '../ui/switch';


const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

const SubscribeAsAgent = ({ onSubscribe, isSubmitting }: { onSubscribe: (plan: 'promo' | 'normal') => void, isSubmitting: boolean }) => {
    const promoFee = 1;
    const normalFee = 3;

    return (
        <div className="pl-10 space-y-4">
            <p>Devenez agent pour débloquer des fonctionnalités exclusives et commencer à gagner des commissions.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Offre d'Essai</CardTitle>
                        <CardDescription>Parfait pour commencer.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">${promoFee}<span className="text-sm text-muted-foreground">/premier mois</span></p>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" onClick={() => onSubscribe('promo')} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Commencer l'essai
                        </Button>
                    </CardFooter>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Plan Normal</CardTitle>
                        <CardDescription>Accès complet et continu.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">${normalFee}<span className="text-sm text-muted-foreground">/mois</span></p>
                    </CardContent>
                    <CardFooter>
                         <Button className="w-full" onClick={() => onSubscribe('normal')} disabled={isSubmitting}>
                             {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            S'abonner
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
};


export function BecomeAgentSection({ user }: { user: User | null }) {
    const { t } = useTranslation();
    const { openAlert } = useAlertDialog();
    
    const [subscription, setSubscription] = useState<AgentSubscription | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isApplying, setIsApplying] = useState(false);
    const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<'promo' | 'normal' | null>(null);

    const pinForm = useForm<z.infer<typeof pinSchema>>({ resolver: zodResolver(pinSchema) });

    const fetchSubscriptionStatus = useCallback(async () => {
        if (user) {
            setIsLoading(true);
            const sub = await getAgentSubscription(user.id);
            setSubscription(sub);
            setIsLoading(false);
        } else {
            setIsLoading(false);
        }
    }, [user]);
    
    useEffect(() => {
        fetchSubscriptionStatus();
    }, [user, fetchSubscriptionStatus]);


    const handleSubscribe = (plan: 'promo' | 'normal') => {
        setSelectedPlan(plan);
        setIsPinDialogOpen(true);
    };

    const handlePinConfirm = async (values: z.infer<typeof pinSchema>) => {
        if (!user || !selectedPlan) return;
        setIsApplying(true);
        const result = await subscribeAsAgent(user.id, selectedPlan, values.pin);
        setIsApplying(false);
        setIsPinDialogOpen(false);
        pinForm.reset();

        if (result.success) {
            openAlert({ variant: 'success', title: 'Abonnement Réussi!', description: 'Bienvenue dans l\'espace agent. Votre compte est maintenant actif.' });
            fetchSubscriptionStatus(); // Refresh status
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
    };
    
    const handleToggleAutoRenew = async (checked: boolean) => {
        if (!user || !subscription?.id) return;
        const result = await setAutoRenew(user.id, checked);
        if (result.success) {
            setSubscription(prev => prev ? { ...prev, auto_renew: checked } : null);
            openAlert({ variant: 'success', title: 'Mise à Jour Réussie', description: `Le renouvellement automatique a été ${checked ? 'activé' : 'désactivé'}.` });
        } else {
            openAlert({ variant: 'error', title: 'Erreur', description: result.error });
        }
    };

    if (isLoading) {
        return <div className="pl-10 h-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
    }

    if (!user) return null;

    // L'agent peut se réabonner si son abonnement est expiré
    const isExpired = subscription?.status === 'expired' || (subscription?.current_period_end && isPast(new Date(subscription.current_period_end)));

    if (subscription?.status === 'active' && !isExpired) {
        return (
             <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <Briefcase className="h-6 w-6 text-muted-foreground" />
                    <div>
                        <p className="font-semibold">{t('becomeAgentTitle')}</p>
                        <p className="text-sm text-muted-foreground">
                            {subscription.current_period_end ? `Votre abonnement est actif jusqu'au ${format(new Date(subscription.current_period_end), 'd MMMM yyyy', { locale: fr })}.` : "Votre abonnement agent est actif."}
                        </p>
                    </div>
                </div>
                 <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">Renouvellement auto.</p>
                    <Switch
                        checked={subscription.auto_renew}
                        onCheckedChange={handleToggleAutoRenew}
                    />
                </div>
             </div>
        )
    }

    return (
       <>
        <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><ShieldCheck/> Confirmer votre abonnement</DialogTitle>
                    <DialogDescription>Entrez votre code PIN pour finaliser le paiement et activer votre compte agent.</DialogDescription>
                </DialogHeader>
                <Form {...pinForm}>
                    <form onSubmit={pinForm.handleSubmit(handlePinConfirm)} className="space-y-6 pt-4">
                        <FormField control={pinForm.control} name="pin" render={({ field }) => (<FormItem><FormLabel>Code PIN</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP></div></FormControl><FormMessage/></FormItem>)}/>
                        <DialogFooter><Button type="submit" variant="gradient" className="w-full" disabled={isApplying}>{isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Confirmer</Button></DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>

        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <Briefcase className="h-6 w-6 text-muted-foreground" />
                <div>
                    <p className="font-semibold">{t('becomeAgentTitle')}</p>
                    <p className="text-sm text-muted-foreground">
                        {isExpired ? "Votre abonnement a expiré. Réabonnez-vous pour retrouver vos accès." : t('becomeAgentDescription')}
                    </p>
                </div>
            </div>
            {isExpired && (
                <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800 ml-10">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="font-bold">ACCÈS SUSPENDU</AlertTitle>
                    <AlertDescription>Veuillez choisir un plan ci-dessous pour réactiver vos outils de vente.</AlertDescription>
                </Alert>
            )}
            <SubscribeAsAgent onSubscribe={handleSubscribe} isSubmitting={isApplying} />
        </div>
       </>
    );
}

function isPast(date: Date): boolean {
    return date.getTime() < Date.now();
}
