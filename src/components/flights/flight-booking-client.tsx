
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
    Plane, ArrowRight, Calendar as CalendarIcon, UserPlus, 
    Trash2, Loader2, ShieldCheck, Info, ArrowDown, Search 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { cn } from '@/lib/utils';
import { searchFlights, createFlightBooking } from '@/lib/actions/flight.actions';
import type { User, Country, FlightOffer } from '@/lib/types';

const formSchema = z.object({
  tripType: z.enum(['oneWay', 'roundTrip']),
  originCountry: z.string({ required_error: "Ville de départ requise." }),
  destinationCountry: z.string({ required_error: "Destination requise." }),
  departureDate: z.date({ required_error: "Date de départ requise." }),
  returnDate: z.date().optional(),
  passengers: z.array(z.object({
    firstName: z.string().min(2, "Prénom requis"),
    lastName: z.string().min(2, "Nom requis"),
    dateOfBirth: z.date({ required_error: "Date de naissance requise" }),
    passportNumber: z.string().min(5, "N° Passeport requis"),
  })).min(1),
  cabinClass: z.enum(['economy', 'business', 'first']),
});

type Step = 'search' | 'selection' | 'passengers' | 'payment';

export function FlightBookingClient({ user, countries }: { user: User, countries: Country[] }) {
    const [step, setStep] = useState<Step>('search');
    const [offers, setOffers] = useState<FlightOffer[]>([]);
    const [selectedOffer, setSelectedOffer] = useState<FlightOffer | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pin, setPin] = useState('');
    const [mounted, setMounted] = useState(false);
    const { openAlert } = useAlertDialog();

    useEffect(() => {
        setMounted(true);
    }, []);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            tripType: 'oneWay',
            cabinClass: 'economy',
            passengers: [{ firstName: user.first_name || '', lastName: user.last_name || '', dateOfBirth: undefined, passportNumber: '' }],
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "passengers"
    });

    const handleSearch = async (values: z.infer<typeof formSchema>) => {
        setIsSearching(true);
        const result = await searchFlights({
            origin: values.originCountry,
            destination: values.destinationCountry,
            departureDate: format(values.departureDate, 'yyyy-MM-dd'),
            returnDate: values.returnDate ? format(values.returnDate, 'yyyy-MM-dd') : undefined,
            passengers: values.passengers.length,
            cabin: values.cabinClass
        });
        setIsSearching(false);

        if (result.success) {
            setOffers(result.offers);
            setStep('selection');
        } else {
            openAlert({ title: "Erreur", description: result.error || "Aucun vol trouvé.", variant: 'error' });
        }
    };

    const handleFinalBooking = async () => {
        if (!selectedOffer || !user) return;
        setIsSubmitting(true);
        
        const values = form.getValues();
        const result = await createFlightBooking(user, {
            ...values as any,
            offerId: selectedOffer.id,
            price: selectedOffer.price,
            currency: selectedOffer.currency,
            airlineName: selectedOffer.airlineName,
            pin
        });

        setIsSubmitting(false);
        if (result.success) {
            openAlert({
                variant: 'success',
                title: "Réservation Réussie !",
                description: result.message,
                onClose: () => window.location.reload()
            });
        } else {
            openAlert({ variant: 'error', title: "Échec du paiement", description: result.error });
            setPin('');
        }
    };

    if (!mounted) return null;

    return (
        <div className="space-y-8">
            <div className="flex gap-2 mb-4">
                {['search', 'selection', 'passengers', 'payment'].map((s, i) => (
                    <div key={s} className={cn(
                        "h-2 w-full rounded-full transition-all duration-300",
                        ['search', 'selection', 'passengers', 'payment'].indexOf(step) >= i ? "bg-primary" : "bg-zinc-200"
                    )} />
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-6">
                    {step === 'search' && (
                        <Card className="shadow-lg border-none">
                            <CardHeader><CardTitle>Rechercher un vol</CardTitle></CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(handleSearch)} className="space-y-6">
                                        <FormField control={form.control} name="tripType" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Type de voyage</FormLabel>
                                                <FormControl>
                                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                                        <div className="flex items-center space-x-2 border rounded-xl p-3 bg-zinc-50 flex-1">
                                                            <RadioGroupItem value="roundTrip" id="rt"/>
                                                            <Label htmlFor="rt" className="w-full font-bold">Aller-retour</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2 border rounded-xl p-3 bg-zinc-50 flex-1">
                                                            <RadioGroupItem value="oneWay" id="ow"/>
                                                            <Label htmlFor="ow" className="w-full font-bold">Aller simple</Label>
                                                        </div>
                                                    </RadioGroup>
                                                </FormControl>
                                            </FormItem>
                                        )}/>
                                        
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="originCountry" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Départ</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl><SelectTrigger className="h-12"><SelectValue placeholder="Ville de départ"/></SelectTrigger></FormControl>
                                                        <SelectContent>{countries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}/>
                                            <FormField control={form.control} name="destinationCountry" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Arrivée</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl><SelectTrigger className="h-12"><SelectValue placeholder="Destination"/></SelectTrigger></FormControl>
                                                        <SelectContent>{countries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}/>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="departureDate" render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Date de départ</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" className={cn("justify-start h-12", !field.value && "text-muted-foreground")}>
                                                                <CalendarIcon className="mr-2 h-4 w-4"/>
                                                                {field.value ? format(field.value, "PPP", { locale: fr }) : "Choisir une date"}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/>
                                                        </PopoverContent>
                                                    </Popover>
                                                </FormItem>
                                            )}/>
                                            <FormField control={form.control} name="returnDate" render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <FormLabel>Date de retour</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" disabled={form.watch('tripType') === 'oneWay'} className={cn("justify-start h-12", !field.value && "text-muted-foreground")}>
                                                                <CalendarIcon className="mr-2 h-4 w-4"/>
                                                                {field.value ? format(field.value, "PPP", { locale: fr }) : "Choisir une date"}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/>
                                                        </PopoverContent>
                                                    </Popover>
                                                </FormItem>
                                            )}/>
                                        </div>

                                        <div className="space-y-4">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Classe de voyage</Label>
                                            <FormField control={form.control} name="cabinClass" render={({ field }) => (
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-3 gap-2">
                                                    {['economy', 'business', 'first'].map(c => (
                                                        <div key={c}>
                                                            <RadioGroupItem value={c} id={`cl-${c}`} className="sr-only" />
                                                            <Label htmlFor={`cl-${c}`} className={cn("flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all h-12 text-xs font-bold uppercase", field.value === c ? "border-primary bg-primary/5 text-primary" : "border-zinc-100 text-zinc-400")}>
                                                                {c === 'economy' ? 'Éco' : c === 'business' ? 'Affaires' : 'First'}
                                                            </Label>
                                                        </div>
                                                    ))}
                                                </RadioGroup>
                                            )}/>
                                        </div>

                                        <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold" variant="gradient" disabled={isSearching}>
                                            {isSearching ? <Loader2 className="animate-spin mr-2"/> : <Plane className="mr-2"/>} TROUVER LES MEILLEURES OFFRES
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    )}

                    {step === 'selection' && (
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg">Offres en temps réel</h3>
                            {offers.map(offer => (
                                <Card 
                                    key={offer.id} 
                                    onClick={() => setSelectedOffer(offer)}
                                    className={cn(
                                        "cursor-pointer transition-all border-2",
                                        selectedOffer?.id === offer.id ? "border-primary bg-primary/5" : "border-zinc-100"
                                    )}
                                >
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-20 relative bg-white rounded border p-1 flex items-center justify-center">
                                                    <img src={offer.airlineLogo} alt={offer.airlineName} className="max-h-full max-w-full object-contain" />
                                                </div>
                                                <span className="font-bold text-sm">{offer.airlineName}</span>
                                            </div>
                                            <p className="text-2xl font-black text-primary">${offer.price} {offer.currency}</p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="text-center sm:text-left">
                                                <p className="text-2xl font-bold">{offer.departureTime}</p>
                                                <p className="text-xs text-muted-foreground font-bold uppercase">{form.getValues('originCountry')}</p>
                                            </div>
                                            <div className="flex-1 px-4 flex flex-col items-center">
                                                <span className="text-[10px] text-muted-foreground uppercase font-bold">{offer.duration}</span>
                                                <div className="h-px bg-zinc-200 w-full relative my-1">
                                                    <Plane className="h-3 w-3 text-zinc-300 absolute -top-1.5 left-1/2 -translate-x-1/2 bg-white px-1"/>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">{offer.stops === 0 ? 'Direct' : `${offer.stops} escale(s)`}</span>
                                            </div>
                                            <div className="text-center sm:text-right">
                                                <p className="text-2xl font-bold">{offer.arrivalTime}</p>
                                                <p className="text-xs text-muted-foreground font-bold uppercase">{form.getValues('destinationCountry')}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            <div className="flex gap-4 pt-4">
                                <Button variant="outline" onClick={() => setStep('search')} className="flex-1 h-12">Retour</Button>
                                <Button className="flex-1 h-12 text-lg font-bold" onClick={() => setStep('passengers')} disabled={!selectedOffer}>
                                    Continuer <ArrowRight className="ml-2 h-4 w-4"/>
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'passengers' && (
                        <div className="space-y-6">
                            <h3 className="font-bold text-lg">Informations Voyageurs</h3>
                            <Form {...form}>
                                <form className="space-y-4">
                                    {fields.map((field, index) => (
                                        <Card key={field.id} className="relative pt-6 border-zinc-100 shadow-sm">
                                            {index > 0 && <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>}
                                            <CardHeader className="pt-0"><CardTitle className="text-sm">Passager #{index + 1}</CardTitle></CardHeader>
                                            <CardContent className="grid md:grid-cols-2 gap-4">
                                                <FormField control={form.control} name={`passengers.${index}.firstName`} render={({ field }) => ( <FormItem><FormLabel>Prénom</FormLabel><FormControl><Input {...field} className="h-11"/></FormControl><FormMessage/></FormItem> )}/>
                                                <FormField control={form.control} name={`passengers.${index}.lastName`} render={({ field }) => ( <FormItem><FormLabel>Nom</FormLabel><FormControl><Input {...field} className="h-11"/></FormControl><FormMessage/></FormItem> )}/>
                                                <FormField control={form.control} name={`passengers.${index}.dateOfBirth`} render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date de naissance</FormLabel><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("justify-start h-11", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP", { locale: fr }) : "Choisir"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent></Popover><FormMessage/></FormItem> )}/>
                                                <FormField control={form.control} name={`passengers.${index}.passportNumber`} render={({ field }) => ( <FormItem><FormLabel>N° Passeport</FormLabel><FormControl><Input {...field} className="h-11 font-mono"/></FormControl><FormMessage/></FormItem> )}/>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </form>
                            </Form>
                            <Button variant="outline" className="w-full border-dashed h-12" onClick={() => append({ firstName: '', lastName: '', dateOfBirth: new Date(), passportNumber: '' })}>
                                <UserPlus className="mr-2 h-4 w-4"/> Ajouter un passager
                            </Button>
                            <div className="flex gap-4 pt-4">
                                <Button variant="outline" onClick={() => setStep('selection')} className="flex-1 h-12">Retour</Button>
                                <Button className="flex-1 h-12 text-lg font-bold" onClick={() => setStep('payment')}>
                                    Payer <ArrowRight className="ml-2 h-4 w-4"/>
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'payment' && (
                        <Card className="border-primary shadow-2xl overflow-hidden">
                            <CardHeader className="text-center bg-primary/5 pb-6">
                                <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-2"/>
                                <CardTitle>Confirmation du Paiement</CardTitle>
                                <CardDescription>Débit direct de votre portefeuille souverain.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                <div className="p-5 bg-zinc-50 rounded-2xl space-y-3 border">
                                    <div className="flex justify-between text-sm"><span>Billets ({fields.length})</span><span className="font-bold">${selectedOffer?.price.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-sm"><span>Taxes & Service</span><span className="font-bold text-green-600">Incluses</span></div>
                                    <Separator className="bg-zinc-200" />
                                    <div className="flex justify-between items-center text-xl font-black text-primary">
                                        <span>Total à payer</span>
                                        <span>${selectedOffer?.price.toFixed(2)} {selectedOffer?.currency}</span>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <Label className="text-center block text-[10px] font-black uppercase tracking-widest text-zinc-500">Saisir votre PIN CashPay</Label>
                                    <div className="flex justify-center">
                                        <InputOTP maxLength={4} value={pin} onChange={setPin}>
                                            <InputOTPGroup>
                                                <InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/>
                                            </InputOTPGroup>
                                        </InputOTP>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="flex-col gap-3">
                                <Button className="w-full h-16 text-xl font-black shadow-xl" variant="gradient" onClick={handleFinalBooking} disabled={isSubmitting || pin.length < 4}>
                                    {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Plane className="mr-2"/>} CONFIRMER LA RÉSERVATION
                                </Button>
                                <Button variant="ghost" onClick={() => setStep('passengers')} disabled={isSubmitting}>Annuler</Button>
                            </CardFooter>
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    {selectedOffer && (
                        <Card className="bg-zinc-50 border-zinc-200 shadow-inner">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Résumé du vol</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-bold text-primary uppercase">{selectedOffer.airlineName}</p>
                                        <p className="text-sm font-bold">{selectedOffer.airlineCode} {Math.floor(100 + Math.random() * 900)}</p>
                                    </div>
                                    <Badge variant="secondary" className="uppercase text-[9px]">{form.watch('cabinClass')}</Badge>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between"><span className="text-xs opacity-60">Départ</span><span className="text-xs font-bold">{format(form.getValues('departureDate'), 'dd MMM yyyy')}</span></div>
                                    <div className="flex justify-between text-sm font-bold"><span>{selectedOffer.departureTime}</span><span>{form.getValues('originCountry')}</span></div>
                                </div>
                                <div className="flex justify-center py-1 opacity-20"><ArrowDown className="h-4 w-4"/></div>
                                <div className="space-y-1">
                                    <div className="flex justify-between"><span className="text-xs opacity-60">Arrivée</span><span className="text-xs font-bold">{format(form.getValues('departureDate'), 'dd MMM yyyy')}</span></div>
                                    <div className="flex justify-between text-sm font-bold"><span>{selectedOffer.arrivalTime}</span><span>{form.getValues('destinationCountry')}</span></div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-3">
                        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                            <span className="font-bold text-primary">Souveraineté Jojo Airlines:</span> Chaque billet émis est immédiatement enregistré dans le GDS international et garanti par les fonds de notre compte flotte souverain.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
