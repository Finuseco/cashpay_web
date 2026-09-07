
'use client';

import { useState } from 'react';
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
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, PlusCircle, Trash2, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { createEvent } from '@/lib/actions/event.actions';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const ticketTypeSchema = z.object({
  type: z.string().min(1, "Le type de billet est requis."),
  price: z.coerce.number().min(0, "Le prix ne peut être négatif."),
  quantity: z.coerce.number().int().min(1, "La quantité doit être d'au moins 1."),
});

const formSchema = z.object({
  name: z.string().min(5, "Le nom de l'événement est requis."),
  description: z.string().min(20, "Une description détaillée est requise."),
  location: z.string().min(3, "Le lieu est requis."),
  date: z.date({ required_error: "La date est requise." }),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format d'heure invalide (HH:MM)."),
  currency: z.enum(['USD', 'EUR', 'CDF'], { required_error: "La devise est requise." }),
  imageUrl: z.string().optional(),
  ticketTypes: z.array(ticketTypeSchema).min(1, "Au moins un type de billet est requis."),
});

export function CreateEventForm() {
    const router = useRouter();
    const { openAlert } = useAlertDialog();
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            currency: 'USD',
            ticketTypes: [{ type: 'Normal', price: 10, quantity: 100 }],
        }
    });

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
        const result = await createEvent(values);
        if (result.success && result.event) {
            openAlert({
                title: 'Événement Créé',
                description: `Votre événement "${values.name}" a été créé avec succès.`,
                variant: 'success'
            });
            router.push(`/events/manage`);
        } else {
            openAlert({ title: 'Erreur', description: result.error, variant: 'error' });
        }
        setIsSubmitting(false);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Créer un Nouvel Événement</CardTitle>
                <CardDescription>Remplissez les détails ci-dessous pour publier votre événement.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nom de l'événement</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} rows={5} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <div className="grid md:grid-cols-2 gap-4">
                             <FormField
                                control={form.control}
                                name="location"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Lieu</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {field.value ? format(field.value, "d MMMM yyyy", { locale: fr }) : <span>Choisir une date</span>}
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                         <div className="grid md:grid-cols-2 gap-4">
                             <FormField
                                control={form.control}
                                name="time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Heure (HH:MM)</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="currency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Devise des billets</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue/>
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="USD">USD ($)</SelectItem>
                                                <SelectItem value="EUR">EUR (€)</SelectItem>
                                                <SelectItem value="CDF">CDF (FC)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                         </div>

                        <FormItem>
                            <FormLabel>Affiche de l'événement</FormLabel>
                             <FormControl>
                                <Input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"/>
                            </FormControl>
                            {imagePreview && <Image src={imagePreview} alt="Aperçu" width={200} height={100} className="mt-2 rounded-md object-cover" />}
                        </FormItem>

                        <div>
                            <FormLabel>Types de Billets</FormLabel>
                            <div className="space-y-4 mt-2">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-12 gap-2 items-end border p-3 rounded-lg">
                                        <FormField
                                            control={form.control}
                                            name={`ticketTypes.${index}.type`}
                                            render={({ field }) => (
                                                <FormItem className="col-span-4">
                                                    <FormLabel>Type</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`ticketTypes.${index}.price`}
                                            render={({ field }) => (
                                                <FormItem className="col-span-3">
                                                    <FormLabel>Prix</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`ticketTypes.${index}.quantity`}
                                            render={({ field }) => (
                                                <FormItem className="col-span-3">
                                                    <FormLabel>Quantité</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="col-span-2 flex justify-end">
                                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ type: '', price: 0, quantity: 50 })}><PlusCircle className="mr-2 h-4 w-4" />Ajouter un type de billet</Button>
                            </div>
                             <FormMessage>{form.formState.errors.ticketTypes?.message}</FormMessage>
                        </div>
                        
                        <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Publier l'événement
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
