
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Briefcase, Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User } from '@/lib/types';
import { getAgentSubscription, subscribeAsAgent, type AgentSubscription } from '@/lib/actions/agent-application.actions';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';

const pinSchema = z.object({
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

export function BecomeAgentSection({ user }: { user: User | null }) {
    const { openAlert } = useAlertDialog();
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    const [subscription, setSubscription] = useState<AgentSubscription | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPinOpen, setIsPinOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<'promo' | 'normal'>('normal');

    const pinForm = useForm<z.infer<typeof pinSchema>>({ resolver: zodResolver(pinSchema) });

    useEffect(() => {
        setIsClient(true);
        if (user) {
            getAgentSubscription(user.id).then(setSubscription);
        }
    }, [user]);

    const handleCheckStatus = async () => {
        if (!user) return;
        setIsLoading(true);
        const sub = await getAgentSubscription(user.id);
        setSubscription(sub);
        setIsLoading(false);
        if (!sub) {
            toast({ title: "Aucun abonnement", description: "Vous n'êtes pas encore enregistré comme agent." });
        }
    };

    const handleConfirmPin = async (values: z.infer<typeof pinSchema>) => {
        if (!user) return;
        setIsLoading(true);
        const result = await subscribeAsAgent(user.id, selectedPlan, values.pin);
        setIsLoading(false);

        if (result.success) {
            openAlert({ title: "Félicitations", description: "Votre statut d'agent est désormais actif.", variant: 'success' });
            setIsPinOpen(false);
            handleCheckStatus();
        } else {
            openAlert({ title: "Échec", description: result.error, variant: 'error' });
            pinForm.reset();
        }
    };

    if (!isClient) return null;

    if (subscription && subscription.status === 'active') {
        return (
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-2xl">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <ShieldCheck className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <p className="font-bold text-sm text-green-800">Compte Agent Actif</p>
                        <p className="text-[10px] text-green-600 font-bold uppercase">Accès illimité aux outils</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleCheckStatus} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4 text-green-600"/>}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center block">Sélectionner un plan d'activation</Label>
                <RadioGroup value={selectedPlan} onValueChange={(v: any) => setSelectedPlan(v)} className="grid grid-cols-2 gap-3">
                    <div className="relative">
                        <RadioGroupItem value="promo" id="p-promo" className="sr-only peer" />
                        <Label htmlFor="p-promo" className={cn("flex flex-col items-center justify-center p-3 border-2 rounded-2xl cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 h-20")}>
                            <span className="font-black text-xl text-primary">$1</span>
                            <span className="text-[9px] uppercase font-black tracking-tighter">Essai 30j</span>
                        </Label>
                    </div>
                    <div className="relative">
                        <RadioGroupItem value="normal" id="p-normal" className="sr-only peer" />
                        <Label htmlFor="p-normal" className={cn("flex flex-col items-center justify-center p-3 border-2 rounded-2xl cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 h-20")}>
                            <span className="font-black text-xl text-primary">$3</span>
                            <span className="text-[9px] uppercase font-black tracking-tighter">Standard / mois</span>
                        </Label>
                    </div>
                </RadioGroup>
            </div>

            <Button className="w-full h-12 font-black text-xs uppercase tracking-widest shadow-lg" variant="gradient" onClick={() => setIsPinOpen(true)} disabled={isLoading}>
                ACTIVER LE STATUT AGENT
            </Button>

            <Dialog open={isPinOpen} onOpenChange={setIsPinOpen}>
                <DialogContent className="max-w-xs bg-zinc-900 border-zinc-800 text-white p-6 rounded-[2rem]">
                    <DialogHeader className="text-center">
                        <DialogTitle className="text-xl font-black uppercase">Validation</DialogTitle>
                        <DialogDescription className="text-zinc-400">Confirmation du débit de {selectedPlan === 'promo' ? '1.00' : '3.00'} USD.</DialogDescription>
                    </DialogHeader>
                    <Form {...pinForm}>
                        <form onSubmit={pinForm.handleSubmit(handleConfirmPin)} className="space-y-6 pt-4 text-center">
                            <FormField control={pinForm.control} name="pin" render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="flex justify-center">
                                            <InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP>
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )}/>
                            <Button type="submit" variant="gradient" className="w-full h-12 font-bold" disabled={isLoading}>
                                {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "PAYER ET ACTIVER"}
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
