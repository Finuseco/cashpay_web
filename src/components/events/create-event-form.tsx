
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
    CalendarIcon, Loader2, PlusCircle, QrCode, ShieldCheck, Trash2, UploadCloud, Video, X, Banknote 
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { cn, countryToCode, getCountryByCode } from '@/lib/utils';
import { createEvent } from '@/lib/actions/event.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import Image from 'next/image';

const ticketTypeSchema = z.object({
    type: z.string().min(1, "Le type de billet est requis."),
    price: z.preprocess((val) => Number(val), z.number().min(0, "Le prix doit être positif.")),
    quantity: z.preprocess((val) => Number(val), z.number().int().min(1, "La quantité doit être au moins 1.")),
});

const formSchema = z.object({
    name: z.string().min(3, { message: "Le nom de l'événement doit comporter au moins 3 caractères." }),
    description: z.string().min(10, { message: "La description doit comporter au moins 10 caractères." }),
    date: z.date({ required_error: "La date est requise." }),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: "Format d'heure invalide (HH:MM)." }),
    location: z.string().optional(),
    currency: z.string({ required_error: "La devise est requise." }),
    imageUrl: z.string().optional(),
    ticketTypes: z.array(ticketTypeSchema).min(1, "Au moins un type de billet est requis."),
    eventType: z.enum(['live', 'zoom'], { required_error: "Sélectionnez un type d'événement." }),
});

export function CreateEventForm() {
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [availableCurrencies, setAvailableCurrencies] = useState(['USD', 'EUR']);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            currency: 'USD',
            ticketTypes: [{ type: 'Normal', price: 10, quantity: 100 }],
            eventType: 'live',
            imageUrl: '',
            name: '',
            description: '',
            location: '',
            time: ''
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "ticketTypes"
    });

    useEffect(() => {
        setMounted(true);
        const loadInitialData = async () => {
            const user = await getAuthenticatedUser();
            if (user?.country) {
                const code = countryToCode(user.country);
                const countryInfo = code ? getCountryByCode(code) : null;
                if (countryInfo?.currency_code && !['USD', 'EUR'].includes(countryInfo.currency_code)) {
                    setAvailableCurrencies(['USD', 'EUR', countryInfo.currency_code]);
                }
            }
        };
        loadInitialData();
    }, []);
    
    const eventType = form.watch('eventType');
    
    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                setImagePreview(dataUrl);
                form.setValue('imageUrl', dataUrl, { shouldValidate: true });
            };
            reader.readAsDataURL(file);
        }
    };
    
    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true);
        const result = await createEvent(values as any);
        if (result.success && result.event) {
            openAlert({
                title: 'Événement Créé',
                description: `Votre événement "${values.name}" a été publié avec succès.`,
                variant: 'success'
            });
            router.push(`/events/manage`);
        } else {
            openAlert({ title: 'Erreur', description: result.error || "Impossible de créer l'événement.", variant: 'error' });
        }
        setIsSubmitting(false);
    }

    if (!mounted) return null;

    return (
        <Card className="border-none shadow-2xl bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10 text-center py-8">
                <CardTitle className="text-2xl font-black text-primary uppercase">Publier un Événement</CardTitle>
                <CardDescription>Remplissez les détails pour vendre vos billets sur CashPay.</CardDescription>
            </CardHeader>
            <CardContent className="pt-8 px-6 sm:px-10">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                        
                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase tracking-widest text-zinc-500 pl-1">Image de l'affiche</Label>
                            <div className="relative group">
                                {imagePreview ? (
                                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-4 border-white shadow-xl ring-1 ring-zinc-200">
                                        <Image src={imagePreview} alt="Aperçu" fill className="object-cover" />
                                        <Button 
                                            type="button" 
                                            variant="destructive" 
                                            size="icon" 
                                            className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg"
                                            onClick={() => { setImagePreview(null); form.setValue('imageUrl', ''); }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center aspect-video w-full rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-primary cursor-pointer transition-all">
                                        <div className="flex flex-col items-center gap-2">
                                            <UploadCloud className="h-12 w-12 text-zinc-300" />
                                            <p className="text-sm font-bold text-zinc-500">Ajouter une affiche</p>
                                            <p className="text-[10px] uppercase text-zinc-400 font-bold tracking-widest">PNG ou JPG (max 2MB)</p>
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-xs font-black uppercase tracking-widest text-zinc-500 pl-1">Nature de l'événement</Label>
                            <FormField control={form.control} name="eventType" render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-4">
                                            <div className="relative">
                                                <RadioGroupItem value="live" id="live" className="sr-only peer" />
                                                <Label htmlFor="live" className={cn("flex flex-col items-center justify-center rounded-2xl border-2 border-zinc-100 bg-white p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-28 shadow-sm")}>
                                                    <QrCode className="mb-2 h-7 w-7 text-zinc-400 peer-data-[state=checked]:text-primary"/>
                                                    <span className="font-black text-xs uppercase tracking-tighter">Sur Site (Phy)</span>
                                                </Label>
                                            </div>
                                            <div className="relative">
                                                <RadioGroupItem value="zoom" id="zoom" className="sr-only peer" />
                                                <Label htmlFor="zoom" className={cn("flex flex-col items-center justify-center rounded-2xl border-2 border-zinc-100 bg-white p-4 hover:bg-zinc-50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all h-28 shadow-sm")}>
                                                    <Video className="mb-2 h-7 w-7 text-zinc-400 peer-data-[state=checked]:text-primary"/>
                                                    <span className="font-black text-xs uppercase tracking-tighter">Webinaire Zoom</span>
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </FormControl>
                                </FormItem>
                            )}/>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-l-4 border-primary pl-3">Détails de l'événement</h3>
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-zinc-600">Titre de l'événement *</FormLabel>
                                    <FormControl><Input placeholder="Ex: Grand Concert de Gala" {...field} className="h-12 bg-zinc-50 border-zinc-200" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {eventType === 'live' && (
                                <FormField control={form.control} name="location" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-zinc-600">Lieu / Adresse *</FormLabel>
                                        <FormControl><Input placeholder="Ex: Palais du Peuple, Kinshasa" {...field} className="h-12 bg-zinc-50 border-zinc-200" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}

                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-zinc-600">Description détaillée *</FormLabel>
                                    <FormControl><Textarea placeholder="Contenu de votre événement..." {...field} rows={4} className="bg-zinc-50 border-zinc-200" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <div className="grid md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="date" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-zinc-600">Date prévue *</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant="outline" className={cn("h-12 pl-3 text-left font-normal bg-zinc-50", !field.value && "text-muted-foreground")}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {field.value ? format(field.value, "d MMMM yyyy", { locale: fr }) : "Choisir une date"}
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="time" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-zinc-600">Heure (HH:MM) *</FormLabel>
                                        <FormControl><Input {...field} placeholder="19:30" className="h-12 bg-zinc-50 border-zinc-200" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary border-l-4 border-primary pl-3">Billetterie & Prix</h3>
                            
                            <div className="space-y-4">
                                <Label className="text-xs font-bold text-zinc-500">Devise des Billets</Label>
                                <FormField control={form.control} name="currency" render={({ field }) => (
                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-3 gap-2">
                                        {availableCurrencies.map(c => (
                                            <div key={c}>
                                                <RadioGroupItem value={c} id={`c-${c}`} className="sr-only" />
                                                <Label htmlFor={`c-${c}`} className={cn("flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer h-12 font-black transition-all", field.value === c ? "border-primary bg-primary/5 text-primary" : "border-zinc-100 text-zinc-400 hover:bg-zinc-50")}>
                                                    {c}
                                                </Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                )} />
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-4">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="grid grid-cols-12 gap-3 items-end border p-6 rounded-3xl bg-zinc-900 text-white relative shadow-lg">
                                            {index > 0 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-red-500 hover:bg-red-500/10" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>}
                                            <FormField control={form.control} name={`ticketTypes.${index}.type`} render={({ field }) => (
                                                <FormItem className="col-span-12 sm:col-span-5">
                                                    <FormLabel className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Catégorie de billet</FormLabel>
                                                    <FormControl><Input placeholder="Ex: VIP, Standard" {...field} className="bg-zinc-800 border-zinc-700 h-11 text-white font-bold"/></FormControl>
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name={`ticketTypes.${index}.price`} render={({ field }) => (
                                                <FormItem className="col-span-6 sm:col-span-4">
                                                    <FormLabel className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Prix unitaire</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"/>
                                                            <Input type="number" step="any" {...field} className="bg-zinc-800 border-zinc-700 h-11 pl-10 text-primary font-black text-lg"/>
                                                        </div>
                                                    </FormControl>
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name={`ticketTypes.${index}.quantity`} render={({ field }) => (
                                                <FormItem className="col-span-6 sm:col-span-3">
                                                    <FormLabel className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Places</FormLabel>
                                                    <FormControl><Input type="number" {...field} className="bg-zinc-800 border-zinc-700 h-11 text-white font-bold text-center"/></FormControl>
                                                </FormItem>
                                            )} />
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" className="w-full border-dashed border-zinc-300 h-14 rounded-2xl hover:border-primary hover:bg-primary/5 text-zinc-500 font-bold" onClick={() => append({ type: '', price: 0, quantity: 100 })}>
                                        <PlusCircle className="mr-2 h-5 w-5" /> Ajouter une catégorie de prix
                                    </Button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="pt-4">
                            <Button type="submit" variant="gradient" className="w-full h-20 text-2xl font-black shadow-2xl rounded-3xl uppercase tracking-tighter" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin mr-3 h-6 w-6"/> : <ShieldCheck className="mr-3 h-6 w-6"/>}
                                Publier maintenant
                            </Button>
                            <p className="text-[10px] text-center text-zinc-400 mt-4 uppercase font-bold tracking-widest">Votre événement sera visible instantanément dans le catalogue national.</p>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
