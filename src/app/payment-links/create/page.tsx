
'use client';

import { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, UploadCloud, Link as LinkIcon, Sparkles, X, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { createPaymentLink } from '@/lib/actions/payment-link.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const categories = [
    "Donation", "Vente", "Événement", "Collecte", "Service", "Autre"
];

const currencies = [
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' },
    { code: 'CDF', symbol: 'FC' }
];

const formSchema = z.object({
  title: z.string().min(5, "Le titre doit contenir au moins 5 caractères."),
  description: z.string().min(10, "Veuillez fournir une description détaillée."),
  category: z.string({ required_error: "Veuillez choisir une catégorie." }),
  isFixed: z.boolean().default(true),
  amount: z.string().optional(),
  currency: z.string().default('USD'),
  imageUrl: z.string().optional(),
});

export default function CreatePaymentLinkPage() {
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    const [mounted, setMounted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            isFixed: true,
            amount: '10',
            currency: 'USD',
            category: 'Donation',
            title: '',
            description: '',
            imageUrl: ''
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
        if (values.isFixed && (!values.amount || parseFloat(values.amount) <= 0)) {
            form.setError('amount', { message: "Le montant est requis." });
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await createPaymentLink(values);
            if (result.success) {
                openAlert({
                    title: 'Lien créé !',
                    description: 'Votre page de paiement est maintenant active.',
                    variant: 'success',
                    onClose: () => router.push('/payment-links')
                });
            } else {
                openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
            }
        } catch (e) {
            openAlert({ title: 'Erreur technique', description: "Une erreur inattendue est survenue.", variant: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!mounted) return null;

    return (
        <DashboardLayout pageTitleKey="Générer un lien">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-2xl font-bold text-foreground">Lien de Paiement</h1>
                    </div>

                    <Card className="shadow-lg border-none bg-card">
                        <CardHeader className="bg-primary/5 border-b border-primary/5">
                            <CardTitle className="flex items-center gap-2 text-primary">
                                <Sparkles className="h-5 w-5"/> Détails de la demande
                            </CardTitle>
                            <CardDescription>Configurez votre page de paiement souveraine.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                    <FormField control={form.control} name="title" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Titre de la demande</FormLabel>
                                            <FormControl><Input placeholder="Ex: Participation au voyage..." {...field} className="h-12 bg-muted/20 border-none rounded-xl" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>

                                    <FormField control={form.control} name="description" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</FormLabel>
                                            <FormControl><Textarea placeholder="Expliquez l'usage des fonds..." {...field} className="min-h-[100px] bg-muted/20 border-none rounded-xl resize-none" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>

                                    <div className="space-y-4">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Catégorie</Label>
                                        <FormField control={form.control} name="category" render={({ field }) => (
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {categories.map(c => (
                                                    <div key={c}>
                                                        <RadioGroupItem value={c} id={`cat-${c}`} className="sr-only" />
                                                        <Label htmlFor={`cat-${c}`} className={cn(
                                                            "flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer h-11 text-xs font-bold transition-all",
                                                            field.value === c ? "border-primary bg-primary/5 text-primary" : "border-zinc-100 text-zinc-400 hover:bg-zinc-50"
                                                        )}>
                                                            {c}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        )}/>
                                    </div>

                                    <div className="space-y-4">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Devise de réception</Label>
                                        <FormField control={form.control} name="currency" render={({ field }) => (
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-3 gap-2">
                                                {currencies.map(c => (
                                                    <div key={c.code}>
                                                        <RadioGroupItem value={c.code} id={`cur-${c.code}`} className="sr-only" />
                                                        <Label htmlFor={`cur-${c.code}`} className={cn(
                                                            "flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer h-11 font-black transition-all",
                                                            field.value === c.code ? "border-primary bg-primary/5 text-primary" : "border-zinc-100 text-zinc-400 hover:bg-zinc-50"
                                                        )}>
                                                            {c.code}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        )}/>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-primary/5 space-y-6 border border-primary/10">
                                        <FormField control={form.control} name="isFixed" render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-sm font-bold">Montant fixe</FormLabel>
                                                    <FormDescription className="text-[10px] uppercase font-bold text-zinc-500">Désactiver pour un montant libre</FormDescription>
                                                </div>
                                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                            </FormItem>
                                        )}/>

                                        {isFixedAmount && (
                                            <FormField control={form.control} name="amount" render={({ field }) => (
                                                <FormItem>
                                                    <FormControl><Input type="number" step="any" placeholder="0.00" {...field} className="h-14 text-3xl font-black text-center border-none bg-background rounded-xl" /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">Image de couverture</Label>
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="relative aspect-video w-full rounded-2xl bg-zinc-50 border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-all overflow-hidden"
                                        >
                                            {imagePreview ? (
                                                <>
                                                    <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                                                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 rounded-full h-8 w-8 z-10" onClick={(e) => { e.stopPropagation(); setImagePreview(null); form.setValue('imageUrl', ''); }}>
                                                        <X className="h-4 w-4"/>
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <UploadCloud className="h-10 w-10 text-zinc-300 mb-2" />
                                                    <p className="text-sm font-bold text-zinc-400">Importer une photo</p>
                                                </>
                                            )}
                                        </div>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                                    </div>

                                    <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl rounded-2xl" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5"/> : <LinkIcon className="mr-2 h-5 w-5"/>} GÉNÉRER LE LIEN
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
