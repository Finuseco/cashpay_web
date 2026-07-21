'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { Product, MlmProductSettings } from '@/lib/types';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const formSchema = z.object({
  pv: z.coerce.number().min(0, "Les Points Volume doivent être positifs."),
  directCommission: z.coerce.number().min(0).max(100, "Le pourcentage doit être entre 0 et 100."),
  level1: z.coerce.number().min(0).max(100),
  level2: z.coerce.number().min(0).max(100),
  level3: z.coerce.number().min(0).max(100),
  level4: z.coerce.number().min(0).max(100),
  level5: z.coerce.number().min(0).max(100),
  binaryCommission: z.coerce.number().min(0).max(100, "Le pourcentage doit être entre 0 et 100."),
  totalPool: z.coerce.number().min(0).max(100, "Le pool total ne peut pas dépasser 100%.")
});


interface MlmProductSettingsFormProps {
    product: Product;
    onSave: (settings: Omit<MlmProductSettings, 'partnerId'>) => void;
}

export function MlmProductSettingsForm({ product, onSave }: MlmProductSettingsFormProps) {
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            pv: 0,
            directCommission: 20,
            level1: 5,
            level2: 3,
            level3: 1.5,
            level4: 0.5,
            level5: 0,
            binaryCommission: 10,
            totalPool: 30,
        }
    });

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        const networkCommissions = values.level1 + values.level2 + values.level3 + values.level4 + values.level5;
        const totalCalculated = values.directCommission + networkCommissions + values.binaryCommission;

        if (totalCalculated > values.totalPool) {
            form.setError('totalPool', {
                type: 'manual',
                message: `Le total des commissions (${totalCalculated}%) dépasse le pool total alloué (${values.totalPool}%).`
            });
            return;
        }

        const settings: Omit<MlmProductSettings, 'partnerId'> = {
            productId: product.id,
            pv: values.pv,
            directCommission: values.directCommission,
            levelCommissions: [values.level1, values.level2, values.level3, values.level4, values.level5],
            binaryCommission: values.binaryCommission,
        };
        onSave(settings);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <Alert>
                    <AlertTitle>Configuration des Commissions</AlertTitle>
                    <AlertDescription>
                        Tous les pourcentages de commission sont calculés sur le prix de vente du produit.
                    </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="pv" render={({ field }) => ( <FormItem><FormLabel>Points Volume (PV)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="totalPool" render={({ field }) => ( <FormItem><FormLabel>Pool Commission Total (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                
                 <FormField control={form.control} name="directCommission" render={({ field }) => ( <FormItem><FormLabel>Commission de Vente Directe (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                
                <div>
                    <FormLabel>Commissions de Réseau (par niveau)</FormLabel>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                        <FormField control={form.control} name="level1" render={({ field }) => ( <FormItem><FormLabel>Niv 1</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="level2" render={({ field }) => ( <FormItem><FormLabel>Niv 2</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="level3" render={({ field }) => ( <FormItem><FormLabel>Niv 3</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="level4" render={({ field }) => ( <FormItem><FormLabel>Niv 4</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="level5" render={({ field }) => ( <FormItem><FormLabel>Niv 5</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )} />
                    </div>
                </div>

                <FormField control={form.control} name="binaryCommission" render={({ field }) => ( <FormItem><FormLabel>Commission Binaire (%)</FormLabel><FormDescription>Pourcentage appliqué sur le volume de la branche la plus faible.</FormDescription><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />


                <Button type="submit" className="w-full">Enregistrer les paramètres</Button>
            </form>
        </Form>
    );
}
