
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { createGroup } from '@/lib/actions/group.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';

const groupFormSchema = z.object({
  name: z.string().min(3, "Le nom du groupe doit contenir au moins 3 caractères."),
  description: z.string().optional(),
  currency: z.enum(['USD', 'EUR', 'CDF'], { required_error: "Veuillez sélectionner une devise." }),
});

export function CreateGroupForm({ onBack, onCreated }: { onBack?: () => void; onCreated?: () => void } = {}) {
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof groupFormSchema>>({
        resolver: zodResolver(groupFormSchema),
        defaultValues: { name: '', description: '', currency: 'USD' },
    });
    
    async function onSubmit(values: z.infer<typeof groupFormSchema>) {
        setIsSubmitting(true);
        const user = await getAuthenticatedUser();
        if (!user) {
            openAlert({ title: "Erreur", description: "Vous devez être connecté.", variant: "error" });
            setIsSubmitting(false);
            return;
        }

        const result = await createGroup(user, values.name, values.currency, values.description);
        
        if (result.success) {
            openAlert({ title: "Groupe créé", description: `Le groupe "${values.name}" a été créé avec succès.`, variant: 'success' });
            if (onCreated) onCreated(); else router.back();
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
        }
        
        setIsSubmitting(false);
    }
    
    return (
        <div className="bg-[#0b141a] h-full min-h-0 flex flex-col">
            <header className="flex items-center p-2 sm:p-3 shrink-0 bg-[#1f2c33] text-white">
                <Button variant="ghost" size="icon" onClick={() => (onBack ? onBack() : router.back())}>
                    <ArrowLeft />
                </Button>
                <h2 className="font-semibold text-lg ml-4">Nouveau Groupe</h2>
            </header>
            <div className="p-4 flex-1 min-h-0 overflow-y-auto pb-24">
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-white">Nom du Groupe</FormLabel>
                                <FormControl><Input placeholder="Ex: Famille, Collègues..." {...field} className="bg-zinc-700 border-zinc-600" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-white">Description (Optionnel)</FormLabel>
                                <FormControl><Textarea placeholder="Objet du groupe..." {...field} className="bg-zinc-700 border-zinc-600" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="currency" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-white">Devise du portefeuille de groupe</FormLabel>
                                <div role="radiogroup" aria-label="Devise" className="grid grid-cols-3 gap-2">
                                    {(['USD', 'EUR', 'CDF'] as const).map((code) => (
                                        <label key={code} className={`flex items-center justify-center gap-2 rounded-lg border p-3 cursor-pointer text-white ${field.value === code ? 'border-primary bg-primary/15' : 'border-zinc-600 bg-zinc-700'}`}>
                                            <input type="radio" name="group-currency" value={code} checked={field.value === code} onChange={() => field.onChange(code)} className="accent-primary" />
                                            {code}
                                        </label>
                                    ))}
                                </div>
                                <FormDescription className="text-zinc-400">
                                    La devise principale pour les transactions de ce groupe.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : null}
                            Créer le Groupe
                        </Button>
                    </form>
                </Form>
            </div>
        </div>
    );
}
