'use client';

import { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, UploadCloud, Link as LinkIcon, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { createPaymentLink } from '@/lib/actions/payment-link.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import Image from 'next/image';

const categories = [
    "Donation", "Contribution", "Vente", "Événement", 
    "Service", "Collecte de fonds", "Cadeau", "Autre"
];

const formSchema = z.object({
  title: z.string().min(5, "Le titre doit contenir au moins 5 caractères."),
  description: z.string().min(10, "Veuillez fournir une description détaillée."),
  category: z.string({ required_error: "Veuillez choisir une catégorie." }),
  isFixed: z.boolean().default(true),
  amount: z.coerce.number().optional(),
  currency: z.string().default('USD'),
  imageUrl: z.string().optional(),
});

export default function CreatePaymentLinkPage() {
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            isFixed: true,
            amount: 10,
            currency: 'USD',
            category: 'Donation'
        }
    });

    const isFixedAmount = form.watch('isFixed');

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                setImagePreview(dataUrl);
                form.setValue('imageUrl', dataUrl);
            };
            reader.readAsDataURL(file);
        }
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (values.isFixed && (!values.amount || values.amount <= 0)) {
            form.setError('amount', { message: "Le montant est requis pour un lien fixe." });
            return;
        }

        setIsSubmitting(true);
        const result = await createPaymentLink(values);
        setIsSubmitting(false);

        if (result.success) {
            openAlert({
                title: 'Lien créé avec succès !',
                description: 'Votre lien de paiement est maintenant actif et prêt à être partagé.',
                variant: 'success',
                onClose: () => router.push('/payment-links')
            });
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
    };

    return (
        <DashboardLayout pageTitleKey="Générer un lien">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft />
                        </Button>
                        <h1 className="text-2xl font-bold">Créer un Lien de Paiement</h1>
                    </div>

                    <Card className="shadow-2xl border-none">
                        <CardHeader className="bg-primary/5 rounded-t-2xl border-b border-primary/10">
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary"/> Détails de la demande
                            </CardTitle>
                            <CardDescription>Configurez votre page de paiement publique.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <FormField control={form.control} name="title" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Titre de la demande</FormLabel>
                                            <FormControl><Input placeholder="Ex: Participation au voyage, Don pour l'association..." {...field} className="h-12" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>

                                    <FormField control={form.control} name="description" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description détaillée</FormLabel>
                                            <FormControl><Textarea placeholder="Expliquez à quoi serviront les fonds..." {...field} className="min-h-[120px]" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <FormField control={form.control} name="category" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Catégorie</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}/>

                                        <FormField control={form.control} name="currency" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Devise</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="USD">USD ($)</SelectItem>
                                                        <SelectItem value="EUR">EUR (€)</SelectItem>
                                                        <SelectItem value="CDF">CDF (FC)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}/>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-muted/30 space-y-4">
                                        <FormField control={form.control} name="isFixed" render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <FormLabel>Montant fixe</FormLabel>
                                                    <FormDescription className="text-[10px]">Désactivez pour laisser le payeur choisir le montant.</FormDescription>
                                                </div>
                                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            </FormItem>
                                        )}/>

                                        {isFixedAmount && (
                                            <FormField control={form.control} name="amount" render={({ field }) => (
                                                <FormItem>
                                                    <FormControl><Input type="number" step="any" placeholder="0.00" {...field} className="h-14 text-2xl font-black text-center" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Image représentative (Optionnel)</Label>
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="relative aspect-video w-full rounded-2xl bg-zinc-50 border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-all overflow-hidden"
                                        >
                                            {imagePreview ? (
                                                <>
                                                    <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                                                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full h-8 w-8" onClick={(e) => { e.stopPropagation(); setImagePreview(null); form.setValue('imageUrl', ''); }}>
                                                        <X className="h-4 w-4"/>
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <UploadCloud className="h-10 w-10 text-zinc-300 mb-2" />
                                                    <p className="text-sm font-medium text-zinc-500">Ajouter une photo de couverture</p>
                                                    <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest font-bold">PNG, JPG ou WEBP</p>
                                                </>
                                            )}
                                        </div>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                                    </div>

                                    <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <LinkIcon className="mr-2"/>} GÉNÉRER LE LIEN DE PAIEMENT
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </DashboardLayout>
    );
}
