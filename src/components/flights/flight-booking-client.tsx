'use client';

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { CalendarIcon, Plane, Plus, Trash2, Loader2, ShieldCheck, ArrowRight, UserPlus, Info, Luggage, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { User } from "@/lib/types";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { createFlightBooking } from "@/lib/actions/flight.actions";
import { searchFlights, type FlightOffer } from "@/services/airlines";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";

type Country = {
    code: string;
    name: string;
    currency_code: string;
};

const passengerSchema = z.object({
  firstName: z.string().min(2, "Prénom requis."),
  lastName: z.string().min(2, "Nom requis."),
  dateOfBirth: z.date({ required_error: "Date de naissance requise."}),
  passportNumber: z.string().min(5, "Numéro de passeport requis pour l'international."),
});

const formSchema = z.object({
  tripType: z.enum(["oneWay", "roundTrip"]),
  originCountry: z.string({ required_error: "Départ requis." }),
  destinationCountry: z.string({ required_error: "Arrivée requise." }),
  departureDate: z.date({ required_error: "Date de départ requise." }),
  returnDate: z.date().optional(),
  passengers: z.array(passengerSchema).min(1, "Au moins un passager."),
  cabinClass: z.enum(["economy", "business", "first"]),
});

export function FlightBookingClient({ user, countries }: { user: User, countries: Country[] }) {
    const [step, setStep] = useState<'search' | 'selection' | 'passengers' | 'payment'>('search');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [offers, setOffers] = useState<FlightOffer[]>([]);
    const [selectedOffer, setSelectedOffer] = useState<FlightOffer | null>(null);
    const [pin, setPin] = useState('');
    const { openAlert } = useAlertDialog();
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            tripType: "roundTrip",
            passengers: [{
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                dateOfBirth: user.birth_date ? new Date(user.birth_date) : undefined,
                passportNumber: '',
            }],
            cabinClass: "economy",
        },
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
        if (result.success) {
            setOffers(result.offers);
            setStep('selection');
        } else {
            openAlert({ title: "Recherche échouée", description: result.error || "Aucun vol trouvé.", variant: 'error' });
        }
        setIsSearching(false);
    };

    const handleProceedToPassengers = () => {
        if (!selectedOffer) return;
        setStep('passengers');
    }

    const handleProceedToPayment = async () => {
        const isValid = await form.trigger('passengers');
        if (isValid) setStep('payment');
    }

    const handleFinalBooking = async () => {
        if (!selectedOffer || pin.length < 4) return;
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

        if (result.success) {
            openAlert({
                variant: 'success',
                title: "Billet Confirmé !",
                description: result.message,
                onClose: () => window.location.reload()
            });
        } else {
            openAlert({ variant: 'error', title: "Échec de l'émission", description: result.error });
            setPin('');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="space-y-8">
            <div className="flex gap-2">
                {['search', 'selection', 'passengers', 'payment'].map((s, i) => (
                    <div key={s} className={cn(
                        "h-2 w-full rounded-full transition-colors",
                        ['search', 'selection', 'passengers', 'payment'].indexOf(step) >= i ? "bg-primary" : "bg-muted"
                    )} />
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-6">
                    {step === 'search' && (
                        <Card className="shadow-lg border-primary/10">
                            <CardHeader><CardTitle>Où voulez-vous aller ?</CardTitle></CardHeader>
                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(handleSearch)} className="space-y-6">
                                        <FormField control={form.control} name="tripType" render={({ field }) => (
                                            <FormItem><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                                <div className="flex items-center space-x-2"><RadioGroupItem value="roundTrip" id="rt"/><FormLabel htmlFor="rt">Aller-retour</FormLabel></div>
                                                <div className="flex items-center space-x-2"><RadioGroupItem value="oneWay" id="ow"/><FormLabel htmlFor="ow">Aller simple</FormLabel></div>
                                            </RadioGroup></FormControl></FormItem>
                                        )}/>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="originCountry" render={({ field }) => ( <FormItem><FormLabel>Ville de départ</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Départ"/></SelectTrigger></FormControl><SelectContent>{countries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select></FormItem> )}/>
                                            <FormField control={form.control} name="destinationCountry" render={({ field }) => ( <FormItem><FormLabel>Ville d'arrivée</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Destination"/></SelectTrigger></FormControl><SelectContent>{countries.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select></FormItem> )}/>
                                        </div>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="departureDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date de départ</FormLabel><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("justify-start h-11", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP", { locale: fr }) : "Choisir"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange}/></PopoverContent></Popover></FormItem> )}/>
                                            <FormField control={form.control} name="returnDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date de retour</FormLabel><Popover><PopoverTrigger asChild><Button variant="outline" disabled={form.watch('tripType') === 'oneWay'} className={cn("justify-start h-11", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP", { locale: fr }) : "Choisir"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange}/></PopoverContent></Popover></FormItem> )}/>
                                        </div>
                                        <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold" disabled={isSearching}>
                                            {isSearching ? <Loader2 className="animate-spin mr-2"/> : <Plane className="mr-2"/>} Trouver les meilleures offres
                                        </Button>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    )}

                    {step === 'selection' && (
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg">Sélectionnez votre vol</h3>
                            {offers.map(offer => (
                                <Card 
                                    key={offer.id} 
                                    onClick={() => setSelectedOffer(offer)}
                                    className={cn(
                                        "cursor-pointer transition-all border-2",
                                        selectedOffer?.id === offer.id ? "border-primary bg-primary/5" : "border-zinc-100 hover:border-zinc-200"
                                    )}
                                >
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-24 relative bg-white rounded border flex items-center justify-center p-1">
                                                    <img src={offer.airlineLogo} alt={offer.airlineName} className="max-h-full max-w-full object-contain" />
                                                </div>
                                                <span className="font-bold text-sm">{offer.airlineName}</span>
                                            </div>
                                            <p className="text-2xl font-black text-primary">${offer.price} {offer.currency}</p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="text-center sm:text-left">
                                                <p className="text-2xl font-bold">{offer.departureTime}</p>
                                                <p className="text-xs text-muted-foreground uppercase font-bold">{form.getValues('originCountry')}</p>
                                            </div>
                                            <div className="flex-1 px-4 flex flex-col items-center">
                                                <span className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{offer.duration}</span>
                                                <div className="h-px bg-zinc-200 w-full relative">
                                                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-background px-2"><Plane className="h-3 w-3 text-zinc-300"/></div>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground mt-1">{offer.stops === 0 ? 'Direct' : `${offer.stops} escale(s)`}</span>
                                            </div>
                                            <div className="text-center sm:text-right">
                                                <p className="text-2xl font-bold">{offer.arrivalTime}</p>
                                                <p className="text-xs text-muted-foreground uppercase font-bold">{form.getValues('destinationCountry')}</p>
                                            </div>
                                        </div>
                                        <Separator className="my-4"/>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1"><Luggage className="h-3 w-3"/> Bagages: {offer.baggageAllowance}</div>
                                            <div className="flex items-center gap-1"><ShieldCheck className="h-3 w-3"/> Remboursable: Non</div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            <div className="flex gap-4">
                                <Button variant="outline" onClick={() => setStep('search')} className="flex-1">Retour</Button>
                                <Button className="flex-1 h-12 text-lg font-bold" onClick={handleProceedToPassengers} disabled={!selectedOffer}>
                                    Continuer <ArrowRight className="ml-2 h-4 w-4"/>
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'passengers' && (
                        <div className="space-y-6">
                            <h3 className="font-bold text-lg">Informations des Passagers</h3>
                            <Form {...form}>
                                <form className="space-y-6">
                                    {fields.map((field, index) => (
                                        <Card key={field.id} className="relative pt-6">
                                            {index > 0 && <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>}
                                            <CardHeader className="pt-0"><CardTitle className="text-sm">Passager #{index + 1}</CardTitle></CardHeader>
                                            <CardContent className="grid md:grid-cols-2 gap-4">
                                                <FormField control={form.control} name={`passengers.${index}.firstName`} render={({ field }) => ( <FormItem><FormLabel>Prénom</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem> )}/>
                                                <FormField control={form.control} name={`passengers.${index}.lastName`} render={({ field }) => ( <FormItem><FormLabel>Nom de famille</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem> )}/>
                                                <FormField control={form.control} name={`passengers.${index}.dateOfBirth`} render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date de naissance</FormLabel><Popover><PopoverTrigger asChild><Button variant="outline" className={cn("justify-start", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4"/>{field.value ? format(field.value, "PPP", { locale: fr }) : "Choisir"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} fromYear={1920} toYear={new Date().getFullYear()} initialFocus/></PopoverContent></Popover><FormMessage/></FormItem> )}/>
                                                <FormField control={form.control} name={`passengers.${index}.passportNumber`} render={({ field }) => ( <FormItem><FormLabel>N° Passeport</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem> )}/>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </form>
                            </Form>
                            <Button variant="outline" className="w-full border-dashed" onClick={() => append({ firstName: '', lastName: '', dateOfBirth: new Date(), passportNumber: '' })}>
                                <UserPlus className="mr-2 h-4 w-4"/> Ajouter un passager
                            </Button>
                            <div className="flex gap-4">
                                <Button variant="outline" onClick={() => setStep('selection')} className="flex-1">Retour</Button>
                                <Button className="flex-1 h-12 text-lg font-bold" onClick={handleProceedToPayment}>
                                    Procéder au paiement <ArrowRight className="ml-2 h-4 w-4"/>
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'payment' && (
                        <Card className="border-primary">
                            <CardHeader className="text-center">
                                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2"><ShieldCheck className="h-6 w-6 text-primary"/></div>
                                <CardTitle>Confirmation du Paiement</CardTitle>
                                <CardDescription>Dernière étape pour confirmer vos billets d'avion.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="p-4 bg-muted rounded-xl space-y-3">
                                    <div className="flex justify-between text-sm"><span>Billets ({fields.length} passagers)</span><span className="font-bold">${selectedOffer?.price}</span></div>
                                    <div className="flex justify-between text-sm"><span>Taxes & Frais</span><span className="font-bold text-green-600">Inclus</span></div>
                                    <Separator/>
                                    <div className="flex justify-between items-center text-lg font-black"><span>Total à débiter</span><span>${selectedOffer?.price} {selectedOffer?.currency}</span></div>
                                </div>
                                
                                <div className="space-y-4">
                                    <Label className="text-center block text-sm font-bold uppercase tracking-widest text-muted-foreground">Saisir votre PIN CashPay</Label>
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
                                <Button className="w-full h-14 text-xl font-black shadow-xl" onClick={handleFinalBooking} disabled={isSubmitting || pin.length < 4}>
                                    {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Plane className="mr-2"/>} CONFIRMER LA RÉSERVATION
                                </Button>
                                <Button variant="ghost" onClick={() => setStep('passengers')} disabled={isSubmitting}>Modifier les passagers</Button>
                            </CardFooter>
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    {selectedOffer && (
                        <Card className="bg-zinc-50 border-zinc-200">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Votre Itinéraire</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-bold text-primary uppercase">{selectedOffer.airlineName}</p>
                                        <p className="text-sm font-bold">{selectedOffer.airlineCode} {Math.floor(100 + Math.random() * 900)}</p>
                                    </div>
                                    <Badge variant="outline">{form.getValues('cabinClass')}</Badge>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between"><span className="text-xs">Départ</span><span className="text-xs font-bold">{format(form.getValues('departureDate'), 'dd MMM yyyy')}</span></div>
                                    <div className="flex justify-between text-sm font-bold"><span>{selectedOffer.departureTime}</span><span>{form.getValues('originCountry')}</span></div>
                                </div>
                                <div className="flex justify-center py-1"><ArrowDown className="h-4 w-4 text-zinc-300"/></div>
                                <div className="space-y-1">
                                    <div className="flex justify-between"><span className="text-xs">Arrivée</span><span className="text-xs font-bold">{format(form.getValues('departureDate'), 'dd MMM yyyy')}</span></div>
                                    <div className="flex justify-between text-sm font-bold"><span>{selectedOffer.arrivalTime}</span><span>{form.getValues('destinationCountry')}</span></div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    
                    <Card className="bg-primary/5 border-primary/10">
                        <CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase text-primary flex items-center gap-2"><ShieldCheck className="h-3 w-3"/> Garantie CashPay</CardTitle></CardHeader>
                        <CardContent className="text-[10px] text-zinc-500 leading-relaxed">
                            Chaque billet émis via Jojo Airlines est immédiatement garanti par les fonds de notre compte flotte partenaire. Le PNR est généré en temps réel.
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
