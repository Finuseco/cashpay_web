
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User } from '@/lib/types';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const profileFormSchema = z.object({
    first_name: z.string().min(2, "Le prénom est requis."),
    last_name: z.string().min(2, "Le nom est requis."),
    profession: z.string().optional(),
    activity_description: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
});

interface ProfileFormProps {
    user: User;
    onSave: (data: z.infer<typeof profileFormSchema>) => void;
    onCancel: () => void;
}

export function ProfileForm({ user, onSave, onCancel }: ProfileFormProps) {
    const form = useForm<z.infer<typeof profileFormSchema>>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            profession: user.profession || '',
            activity_description: user.activity_description || '',
            address: user.address || '',
            city: user.city || '',
        },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="first_name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Prénom</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="last_name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nom</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </div>
                 <FormField control={form.control} name="profession" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Profession</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField control={form.control} name="activity_description" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Bio / Description</FormLabel>
                        <FormControl><Textarea {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="address" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Adresse</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                     <FormField control={form.control} name="city" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Ville</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </div>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
                    <Button type="submit">Enregistrer</Button>
                </div>
            </form>
        </Form>
    )
}
