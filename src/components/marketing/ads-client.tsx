
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle, Loader2, Megaphone } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User, AdCampaign, Product } from '@/lib/types';
import { createAdCampaign, getAdCampaignsForUser } from '@/lib/actions/ads.actions';
import { AdsCampaignTable } from './ads-campaign-table';
import { useSearchParams } from 'next/navigation';
import { getProductById } from '@/lib/actions/shopping.actions';

const adFormSchema = z.object({
  name: z.string().min(5, "Le nom de la campagne est requis."),
  targetUrl: z.string().url("Veuillez entrer une URL valide."),
  format: z.enum(['banner', 'popup', 'video'], { required_error: "Veuillez sélectionner un format."}),
  budget: z.coerce.number().min(10, "Le budget minimum est de 10 USD."),
  durationDays: z.coerce.number().int().min(1, "La durée doit être d'au moins 1 jour."),
  imageUrl: z.string().optional(), // We'll handle this separately
});

const CreateAdForm = ({ user, onCampaignCreated, productToBoost }: { user: User, onCampaignCreated: () => void, productToBoost?: Product | null }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { openAlert } = useAlertDialog();
    
    const form = useForm<z.infer<typeof adFormSchema>>({
        resolver: zodResolver(adFormSchema),
        defaultValues: {
            name: productToBoost ? `Promo - ${productToBoost.name}` : '',
            targetUrl: productToBoost ? `${process.env.NEXT_PUBLIC_APP_URL}/shopping/${productToBoost.id}` : '',
            budget: 10,
            durationDays: 7,
            format: 'banner',
            imageUrl: productToBoost?.image || '',
        }
    });

    const onSubmit = async (values: z.infer<typeof adFormSchema>) => {
        setIsSubmitting(true);
        const result = await createAdCampaign({
            ...values,
            user,
            imageUrl: values.imageUrl || 'https://placehold.co/728x90.png'
        });
        setIsSubmitting(false);

        if (result.success) {
            openAlert({
                title: 'Campagne Soumise',
                description: 'Votre campagne publicitaire a été soumise pour validation.',
                variant: 'success'
            });
            onCampaignCreated();
            form.reset();
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Nom de la campagne</FormLabel> <FormControl> <Input placeholder="Ex: Promo de Pâques" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="targetUrl" render={({ field }) => ( <FormItem> <FormLabel>URL de destination</FormLabel> <FormControl> <Input placeholder="https://votre-site.com/promo" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
                <FormField control={form.control} name="format" render={({ field }) => ( <FormItem> <FormLabel>Format de l'annonce</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl> <SelectTrigger> <SelectValue /> </SelectTrigger> </FormControl> <SelectContent> <SelectItem value="banner">Bannière (728x90)</SelectItem> <SelectItem value="popup">Pop-up (300x250)</SelectItem> <SelectItem value="video">Vidéo (format 16:9)</SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )}/>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="budget" render={({ field }) => ( <FormItem> <FormLabel>Budget (USD)</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
                    <FormField control={form.control} name="durationDays" render={({ field }) => ( <FormItem> <FormLabel>Durée (jours)</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
                </div>
                 <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting && <Loader2 className="animate-spin mr-2"/>}
                    Soumettre pour validation
                </Button>
            </form>
        </Form>
    );
};


export function AdsClient({ user, initialCampaigns }: { user: User, initialCampaigns: AdCampaign[] }) {
    const searchParams = useSearchParams();
    const productId = searchParams.get('productId');

    const [campaigns, setCampaigns] = useState<AdCampaign[]>(initialCampaigns);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [productToBoost, setProductToBoost] = useState<Product | null>(null);

    const refreshCampaigns = async () => {
        const updatedCampaigns = await getAdCampaignsForUser(user.id);
        setCampaigns(updatedCampaigns);
        setIsCreateOpen(false); // Close dialog on success
    };

    const handleOpenDialog = useCallback((product?: Product | null) => {
        setProductToBoost(product || null);
        setIsCreateOpen(true);
    }, []);

    useEffect(() => {
        if (productId) {
            const fetchProduct = async () => {
                const product = await getProductById(productId);
                if (product) {
                    handleOpenDialog(product);
                }
            };
            fetchProduct();
        }
    }, [productId, handleOpenDialog]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Megaphone/> Centre de Publicité</h1>
                    <p className="text-muted-foreground">Créez et gérez vos campagnes publicitaires sur le réseau CashPay.</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => handleOpenDialog()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Créer une Campagne
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{productToBoost ? 'Booster un Produit' : 'Nouvelle Campagne Publicitaire'}</DialogTitle>
                            <DialogDescription>
                                Remplissez les informations ci-dessous. Votre campagne sera soumise à notre équipe pour approbation.
                            </DialogDescription>
                        </DialogHeader>
                        <CreateAdForm user={user} onCampaignCreated={refreshCampaigns} productToBoost={productToBoost} />
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Mes Campagnes</CardTitle>
                </CardHeader>
                <CardContent>
                    <AdsCampaignTable campaigns={campaigns} />
                </CardContent>
            </Card>
        </div>
    );
}
