
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Fuel, ScanLine, ArrowRightLeft, Droplets, ShieldCheck, Loader2, QrCode, Wallet, Info, ArrowDown, KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge, } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { purchaseFuel, generateFuelToken } from '@/lib/actions/fuel.actions';
import type { User, FuelStation, FuelProduct, Currency } from '@/lib/types';
import { QrScannerDialog } from '@/components/shared/qr-scanner-dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { getExchangeRatesForCountry } from '@/lib/actions/exchange.actions';
import { countryToCode } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  stationId: z.string({ required_error: "Veuillez sélectionner une station." }),
  productId: z.string({ required_error: "Veuillez sélectionner un type de carburant." }),
  paymentCurrency: z.string({ required_error: "Veuillez choisir un portefeuille." }),
  inputMode: z.enum(['amount', 'liters']),
  purchaseMethod: z.enum(['direct', 'token']).default('direct'),
  value: z.coerce.number().positive("La valeur doit être positive."),
});

const pinSchema = z.object({
  pin: z.string().length(4, "PIN requis."),
});

export function FuelPurchaseClient({ user, initialStations, currencies }: { user: User, initialStations: FuelStation[], currencies: Currency[] }) {
    const router = useRouter();
    const [step, setStep] = useState<'details' | 'confirm'>('details');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [selectedStation, setSelectedStation] = useState<FuelStation | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rates, setRates] = useState<any[]>([]);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { inputMode: 'amount', paymentCurrency: 'USD', purchaseMethod: 'direct' }
    });

    const pinForm = useForm<z.infer<typeof pinSchema>>({
        resolver: zodResolver(pinSchema)
    });

    const watchStationId = form.watch('stationId');
    const watchProductId = form.watch('productId');
    const watchMode = form.watch('inputMode');
    const watchMethod = form.watch('purchaseMethod');
    const watchValue = form.watch('value');
    const watchPaymentCurrency = form.watch('paymentCurrency');

    useEffect(() => {
        getExchangeRatesForCountry(countryToCode(user.country)).then(setRates);
    }, [user.country]);

    useEffect(() => {
        if (watchStationId) {
            const station = initialStations.find(s => s.id.toString() === watchStationId);
            setSelectedStation(station || null);
            if (station && station.products.length > 0) {
                form.setValue('productId', station.products[0].id.toString());
            }
        }
    }, [watchStationId, initialStations, form]);

    const selectedProduct = useMemo(() => {
        return selectedStation?.products.find(p => p.id.toString() === watchProductId);
    }, [selectedStation, watchProductId]);

    const calculation = useMemo(() => {
        if (!selectedProduct || !watchValue || !selectedStation) return { amountToPay: 0, amountLocal: 0, liters: 0, rate: 1 };
        
        const pricePerLiter = selectedProduct.pricePerLiter;
        const stationCurrency = selectedStation.baseCurrency;
        
        let rate = 1;
        if (watchPaymentCurrency !== stationCurrency) {
            const rateObj = rates.find(r => r.from_currency === watchPaymentCurrency && r.to_currency === stationCurrency);
            rate = rateObj?.rate || 1;
        }

        if (watchMode === 'amount') {
            const amountInLocal = watchValue * rate;
            return { 
                amountToPay: watchValue, 
                amountLocal: amountInLocal, 
                liters: amountInLocal / pricePerLiter,
                rate
            };
        } else {
            const amountInLocal = watchValue * pricePerLiter;
            return { 
                amountToPay: amountInLocal / rate, 
                amountLocal: amountInLocal, 
                liters: watchValue,
                rate
            };
        }
    }, [selectedProduct, watchValue, watchMode, watchPaymentCurrency, selectedStation, rates]);

    const handleFinalSubmit = async (values: z.infer<typeof pinSchema>) => {
        if (!selectedStation || !selectedProduct) return;
        setIsSubmitting(true);
        
        let result;
        if (watchMethod === 'token') {
            result = await generateFuelToken({
                user,
                stationId: selectedStation.id.toString(),
                productId: selectedProduct.id.toString(),
                amount: calculation.amountToPay,
                currency: watchPaymentCurrency,
                liters: calculation.liters,
                pin: values.pin
            });
        } else {
            result = await purchaseFuel({
                user,
                stationId: selectedStation.id.toString(),
                productId: selectedProduct.id.toString(),
                amountToPay: calculation.amountToPay,
                paymentCurrency: watchPaymentCurrency,
                liters: calculation.liters,
                pin: values.pin
            });
        }
        
        setIsSubmitting(false);

        if (result.success) {
            if (watchMethod === 'token') {
                openAlert({
                    title: "Code Pompe Généré",
                    description: (
                        <div className="text-center space-y-4">
                            <p>Saisissez ce code sur la borne automatique de la station :</p>
                            <p className="text-3xl font-black tracking-widest bg-zinc-100 p-4 rounded-xl border-2 border-primary text-primary">{(result as any).token}</p>
                            <p className="text-xs text-muted-foreground italic">Code valable 24h pour {calculation.liters.toFixed(2)}L.</p>
                        </div>
                    ),
                    variant: 'success',
                    onClose: () => router.push('/transactions')
                });
            } else {
                openAlert({
                    title: "Paiement Réussi",
                    description: `Votre achat de ${calculation.liters.toFixed(2)}L à ${selectedStation.name} a été validé. Présentez votre reçu au pompiste.`,
                    variant: 'success',
                    onClose: () => router.push('/transactions')
                });
            }
        } else {
            openAlert({ title: "Erreur", description: result.error, variant: 'error' });
            pinForm.reset();
        }
    };

    return (
        <div className="max-w-md mx-auto space-y-6">
            <QrScannerDialog open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={(data) => {
                setIsScannerOpen(false);
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === 'FUEL_STATION') form.setValue('stationId', parsed.id.toString());
                } catch(e) { /* ignore */ }
            }} />

            {step === 'details' ? (
                <Card className="shadow-2xl border-none">
                    <CardHeader className="text-center bg-primary/5 rounded-t-2xl border-b border-primary/10">
                        <Fuel className="text-primary h-12 w-12 mx-auto mb-2"/>
                        <CardTitle>CashPay Fuel</CardTitle>
                        <CardDescription>Paiement sécurisé ou service autonome 24h/24.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(() => setStep('confirm'))} className="space-y-6">
                                <FormField control={form.control} name="purchaseMethod" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-4">
                                                <div className="relative"><RadioGroupItem value="direct" id="met-dir" className="sr-only peer" /><Label htmlFor="met-dir" className="flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted transition-all"><ShieldCheck className="h-4 w-4 mb-1 text-muted-foreground"/>Pompiste</Label></div>
                                                <div className="relative"><RadioGroupItem value="token" id="met-tok" className="sr-only peer" /><Label htmlFor="met-tok" className="flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted transition-all"><KeyRound className="h-4 w-4 mb-1 text-muted-foreground"/>Self-Service</Label></div>
                                            </RadioGroup>
                                        </FormControl>
                                    </FormItem>
                                )}/>

                                <div className="flex gap-2">
                                    <FormField control={form.control} name="stationId" render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Station-Service</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-12"><SelectValue placeholder="Choisir une station"/></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {initialStations.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.province})</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}/>
                                    <Button type="button" variant="outline" size="icon" className="mt-8 h-12 w-12 rounded-xl" onClick={() => setIsScannerOpen(true)}>
                                        <ScanLine className="h-5 w-5" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="productId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Carburant</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedStation}>
                                                <FormControl><SelectTrigger className="h-11"><SelectValue/></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {selectedStation?.products.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}/>
                                    <FormField control={form.control} name="paymentCurrency" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Payer avec</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger className="h-11"><SelectValue/></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}/>
                                </div>

                                <FormField control={form.control} name="inputMode" render={({ field }) => (
                                    <FormItem><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-4">
                                        <div className="relative"><RadioGroupItem value="amount" id="m-amt" className="sr-only peer" /><Label htmlFor="m-amt" className="flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted transition-all"><Wallet className="h-4 w-4 mb-1 text-muted-foreground"/>Montant</Label></div>
                                        <div className="relative"><RadioGroupItem value="liters" id="m-lit" className="sr-only peer" /><Label htmlFor="m-lit" className="flex flex-col items-center justify-center p-3 border-2 rounded-xl cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted transition-all"><Droplets className="h-4 w-4 mb-1 text-muted-foreground"/>Volume (L)</Label></div>
                                    </RadioGroup></FormControl></FormItem>
                                )}/>

                                <FormField control={form.control} name="value" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{watchMode === 'amount' ? `Montant en ${watchPaymentCurrency}` : 'Volume en Litres'}</FormLabel>
                                        <FormControl><Input type="number" step="any" placeholder="0.00" {...field} value={field.value || ''} className="h-14 text-2xl font-black text-center" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>

                                {calculation.amountToPay > 0 && (
                                    <div className="p-4 bg-muted/30 rounded-2xl border border-dashed text-center">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Équivalence estimée</p>
                                        <p className="text-2xl font-black text-primary">
                                            {watchMode === 'amount' ? `${calculation.liters.toFixed(2)} L` : `${calculation.amountToPay.toFixed(2)} ${watchPaymentCurrency}`}
                                        </p>
                                        {watchPaymentCurrency !== selectedStation?.baseCurrency && (
                                            <p className="text-[9px] text-zinc-400 mt-1 italic">Conversion via Taux Souverain : {calculation.rate.toFixed(2)}</p>
                                        )}
                                    </div>
                                )}

                                <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-black shadow-xl" disabled={!watchValue || !selectedProduct}>
                                    VÉRIFIER LE PAIEMENT
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-primary shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldCheck className="h-32 w-32 text-primary" /></div>
                    <CardHeader className="text-center">
                        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2"><Fuel className="text-primary h-8 w-8"/></div>
                        <CardTitle>Confirmation de l'Achat</CardTitle>
                        <CardDescription>Station : <strong>{selectedStation?.name}</strong></CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-muted/50 p-5 rounded-2xl space-y-3">
                            <div className="flex justify-between text-sm"><span>Méthode :</span>< Badge variant="outline">{watchMethod === 'token' ? 'Self-Service' : 'Pompiste'}</Badge></div>
                            <div className="flex justify-between text-sm"><span>Produit :</span><span className="font-bold">{selectedProduct?.name}</span></div>
                            <div className="flex justify-between text-sm"><span>Volume :</span><span className="font-black text-primary">{calculation.liters.toFixed(2)} Litres</span></div>
                            <Separator className="bg-zinc-200" />
                            <div className="flex justify-between items-baseline font-black text-2xl text-foreground">
                                <span>Total débité :</span>
                                <span>{calculation.amountToPay.toFixed(2)} {watchPaymentCurrency}</span>
                            </div>
                        </div>

                        <Form {...pinForm}>
                            <form onSubmit={pinForm.handleSubmit(handleFinalSubmit)} className="space-y-8">
                                <FormField control={pinForm.control} name="pin" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-center block font-bold text-xs uppercase text-muted-foreground">Entrez votre PIN CashPay</FormLabel>
                                        <FormControl>
                                            <div className="flex justify-center">
                                                <InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0}/><InputOTPSlot index={1}/><InputOTPSlot index={2}/><InputOTPSlot index={3}/></InputOTPGroup></InputOTP>
                                            </div>
                                        </FormControl>
                                    </FormItem>
                                )}/>
                                <div className="flex flex-col gap-3">
                                    <Button type="submit" variant="gradient" className="w-full h-14 text-xl font-black shadow-2xl" disabled={isSubmitting || pinForm.watch('pin').length < 4}>
                                        {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <ShieldCheck className="mr-2"/>} 
                                        {watchMethod === 'token' ? 'GÉNÉRER LE CODE POMPE' : 'VALIDER LE PAIEMENT'}
                                    </Button>
                                    <Button type="button" variant="ghost" onClick={() => setStep('details')} disabled={isSubmitting}>Modifier ma commande</Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
