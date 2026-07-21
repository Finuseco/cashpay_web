'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { MonPaysActivity, MonPaysCompany } from '@/lib/types';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { boostActivity } from '@/lib/actions/monpays.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Loader2, ShieldCheck } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';

const formSchema = z.object({
  amount: z.coerce.number().min(500, { message: 'Le boost minimum est de 500 CDF.' }),
  pin: z.string().length(4, "Le PIN est requis."),
});

export function BoostDialog({ children, activity, company }: { children: React.ReactNode, activity: MonPaysActivity, company: MonPaysCompany }) {
    const { openAlert } = useAlertDialog();
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { amount: 500, pin: '' },
    });
    
    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        const user = await getAuthenticatedUser();
        if (!user) return;

        setIsSubmitting(true);
        const result = await boostActivity(activity.id, user.id, values.amount, values.pin);
        setIsSubmitting(false);

        if (result.success) {
            openAlert({
                variant: 'success',
                title: 'Boost Réussi !',
                description: `Merci pour votre soutien ! ${values.amount} CDF ont été ajoutés au budget de partage de "${company.name}". Votre publication est maintenant monétisée et sera diffusée sur le réseau partenaire.`,
                onClose: () => window.location.reload()
            });
            setOpen(false);
            form.reset();
        } else {
            openAlert({ title: 'Erreur', description: result.error || "Impossible de booster la publication.", variant: 'error' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
                <DialogHeader>
                    <DialogTitle>Booster l'Activité</DialogTitle>
                    <DialogDescription>
                        Soutenez "{company.name}" en contribuant à son budget de partage. Chaque partage par un utilisateur sera récompensé depuis cette cagnotte.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Montant du budget publicitaire (CDF)</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} className="bg-zinc-800 border-zinc-600" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="pin"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2"><ShieldCheck className="h-4 w-4"/> PIN de sécurité</FormLabel>
                                    <FormControl>
                                        <div className="flex justify-center">
                                            <InputOTP maxLength={4} {...field}>
                                                <InputOTPGroup>
                                                    <InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/>
                                                </InputOTPGroup>
                                            </InputOTP>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                         <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline" className="bg-zinc-800 border-zinc-600 hover:bg-zinc-700">Annuler</Button></DialogClose>
                            <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Booster maintenant
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}