
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, getCountryByCode, countryToCode } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, PlusCircle, Trash2, Loader2, Video, Scan } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { createEvent } from '@/lib/actions/event.actions';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import type { User } from '@/lib/types';
import { useTranslation } from 'react-i18next';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';

const ticketTypeSchema = z.object({
  type: z.string().min(1, "Le type de billet est requis."),
  price: z.coerce.number().min(0, "Le prix ne peut être négatif."),
  quantity: z.coerce.number().int().min(1, "La quantité doit être d'au moins 1."),
});

const formSchema = z.object({
  name: z.string().min(5, "Le nom de l'événement est requis."),
  description: z.string().min(20, "Une description détaillée est requise."),
  location: z.string().optional(),
  date: z.date({ required_error: "La date est requise." }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format d'heure invalide (HH:MM)."),
  currency: z.string({ required_error: "La devise est requise." }),
  imageUrl: z.string().optional(),
  ticketTypes: z.array(ticketTypeSchema).min(1, "Au moins un type de billet est requis."),
  eventType: z.enum(['live', 'zoom'], { required_error: "Veuillez sélectionner un type d'événement." }),
}).refine(data => data.eventType === 'live' ? !!data.location : true, {
    message: "Le lieu est requis pour un événement sur site.",
    path: ['location'],
});

export function CreateEventForm() {
    const { t } = useTranslation();
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [user, setUser] = useState<User | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            currency: 'USD',
            ticketTypes: [{ type: 'Normal', price: 10, quantity: 100 }],
            eventType: 'live',
        }
    });

    useEffect(() => {
        getAuthenticatedUser().then(setUser);
    }, []);

    const eventType = form.watch('eventType');

    const userCountryCode = user?.country ? countryToCode(user.country) : null;
    const userCountryInfo = userCountryCode ? getCountryByCode(userCountryCode) : null;
    const localCurrency = userCountryInfo?.currency_code;
    
    const currencyOptions = ['USD', 'EUR'];
    if (localCurrency && !currencyOptions.includes(localCurrency)) {
        currencyOptions.push(localCurrency);
    }

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "ticketTypes"
    });
    
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
        // Explicitly cast to any to handle Omit types in the action interface
        const result = await createEvent(values as any);
        if (result.success && result.event) {
            openAlert({
                title: t('createEventSuccessTitle'),
                description: t('createEventSuccessDesc', { eventName: values.name }),
                variant: 'success'
            });
            router.push(`/events/manage`);
        } else {
            openAlert({ title: t('createEventErrorTitle'), description: result.error || "Une erreur est survenue.", variant: 'error' });
        }
        setIsSubmitting(false);
    }

    const eventCurrency = form.watch('currency');

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('createEventFormTitle')}</CardTitle>
                <CardDescription>{t('createEventFormDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        
                        <FormField control={form.control} name="eventType" render={({ field }) => (
                            <FormItem className="space-y-3"><FormLabel>Type d'événement</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                <FormItem><FormControl><RadioGroupItem value="live" id="live" className="sr-only peer"/></FormControl><Label htmlFor="live" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"><Scan className="mb-2 h-6 w-6"/>Sur Site</Label></FormItem>
                                <FormItem><FormControl><RadioGroupItem value="zoom" id="zoom" className="sr-only peer"/></FormControl><Label htmlFor="zoom" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"><Video className="mb-2 h-6 w-6"/>En Ligne (Zoom)</Label></FormItem>
                            </RadioGroup></FormControl><FormMessage/></FormItem>
                        )}/>

                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>{t('createEventNameLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        
                        {eventType === 'live' && (
                            <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>{t('createEventLocationLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        )}
                        
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>{t('createEventDescLabel')}</FormLabel><FormControl><Textarea {...field} rows={5} /></FormControl><FormMessage /></FormItem>)} />
                        
                        <div className="grid md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="date" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>{t('createEventDateLabel')}</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "d MMMM yyyy", { locale: fr }) : <span>{t('createEventChooseDate')}</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                              <FormField control={form.control} name="time" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>{t('createEventTimeLabel')}</FormLabel><FormControl><Input {...field} type="time" /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="currency" render={({ field }) => (<FormItem><FormLabel>{t('createEventCurrencyLabel')}</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{currencyOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>

                        <FormItem>
                            <FormLabel>{t('createEventImageLabel')}</FormLabel>
                             <FormControl>
                                <Input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"/>
                            </FormControl>
                            {imagePreview && <Image src={imagePreview} alt="Aperçu" width={200} height={100} className="mt-2 rounded-md object-cover" />}
                        </FormItem>

                        <div>
                            <FormLabel>{t('createEventTicketTypesLabel')}</FormLabel>
                            <div className="space-y-4 mt-2">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-12 gap-2 items-end border p-3 rounded-lg">
                                        <FormField control={form.control} name={`ticketTypes.${index}.type`} render={({ field }) => (<FormItem className="col-span-4"><FormLabel>{t('createEventTypeLabel')}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name={`ticketTypes.${index}.price`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel>{t('createEventPriceLabel')} ({eventCurrency})</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name={`ticketTypes.${index}.quantity`} render={({ field }) => (<FormItem className="col-span-3"><FormLabel>{t('createEventQuantityLabel')}</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <div className="col-span-2 flex justify-end">
                                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ type: '', price: 0, quantity: 50 })}><PlusCircle className="mr-2 h-4 w-4" />{t('createEventAddTicketType')}</Button>
                            </div>
                             <FormMessage>{form.formState.errors.ticketTypes?.message}</FormMessage>
                        </div>
                        
                        <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {t('createEventPublishButton')}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
