
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User, CryptoBalance, Currency } from '@/lib/types';
import { Loader2, ArrowDown } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { convertCryptoToFiat, convertFiatToCrypto } from '@/lib/actions/crypto.actions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { getLiveCryptoPrice } from '@/services/crypto-pricing';
import { debounce } from 'lodash';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const SUPPORTED_CRYPTOS = ['BTC', 'ETH', 'USDT_ERC20', 'USDT_TRC20', 'AFC'];

const cryptoToFiatSchema = z.object({
  amount: z.coerce.number().positive("Le montant doit être positif."),
  crypto: z.string({ required_error: "Veuillez sélectionner une cryptomonnaie." }),
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});

const fiatToCryptoSchema = z.object({
  amount: z.coerce.number().positive("Le montant doit être positif."),
  fiat: z.string({ required_error: "Veuillez sélectionner un portefeuille." }),
  crypto: z.string({ required_error: "Veuillez sélectionner une cryptomonnaie." }),
  pin: z.string().length(4, "Le PIN doit contenir 4 chiffres."),
});


interface ConversionFlowProps {
    user: User;
    balances: CryptoBalance[];
    fiatCurrencies: Currency[];
}

const CryptoToFiat = ({ user, balances, fiatCurrencies }: ConversionFlowProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingRate, setIsFetchingRate] = useState(false);
    const [usdValue, setUsdValue] = useState<number | null>(null);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof cryptoToFiatSchema>>({
        resolver: zodResolver(cryptoToFiatSchema),
        defaultValues: { crypto: 'BTC' },
    });
    
    const selectedCrypto = form.watch('crypto');
    const amountToConvert = form.watch('amount');
    const balance = balances.find(b => b.currency_code === selectedCrypto)?.balance || 0;

    const debouncedFetchRate = useCallback(debounce(async (amount: number, cryptoSymbol: string) => {
        if (amount > 0) {
            setIsFetchingRate(true);
            const result = await getLiveCryptoPrice(cryptoSymbol, 'USD');
            if (result.success && result.price) {
                setUsdValue(amount * result.price);
            } else { setUsdValue(null); }
            setIsFetchingRate(false);
        } else { setUsdValue(null); }
    }, 500), []);

    useEffect(() => {
        if (selectedCrypto) debouncedFetchRate(amountToConvert, selectedCrypto);
    }, [amountToConvert, selectedCrypto, debouncedFetchRate]);

    const onSubmit = async (values: z.infer<typeof cryptoToFiatSchema>) => {
        setIsLoading(true);
        const result = await convertCryptoToFiat({ userId: user.id, pin: values.pin, fromCurrency: values.crypto, fromAmount: values.amount });
        if (result.success) {
            openAlert({ title: "Conversion Réussie", description: `Vous avez converti ${values.amount} ${values.crypto} en USD. Votre portefeuille a été crédité.`, variant: "success" });
            form.reset();
        } else { openAlert({ title: "Erreur de Conversion", description: result.error, variant: "error" }); }
        setIsLoading(false);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="crypto" render={({ field }) => ( <FormItem><FormLabel>Convertir depuis</FormLabel><FormControl>
<div className="space-y-2">{balances.map(b => (
<label key={b.currency_code} className="flex items-center gap-3 rounded-lg border border-zinc-600 bg-zinc-700 p-3 text-white">
<input type="radio" name="conversion-crypto" value={b.currency_code} checked={field.value === b.currency_code} onChange={() => field.onChange(b.currency_code)} />
<span>{b.currency_code} (Solde: {b.balance.toFixed(8)})</span>
</label>
))}</div>
</FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant à convertir</FormLabel><FormControl><Input type="number" step="any" {...field} value={field.value || ''} className="bg-zinc-700 border-zinc-600" /></FormControl><FormMessage /></FormItem> )}/>
                <div className="h-10 flex items-center justify-center">{isFetchingRate ? <Loader2 className="animate-spin"/> : usdValue !== null ? <p className="text-lg font-bold text-green-400">≈ ${usdValue.toFixed(2)} USD</p> : null}</div>
                <FormField control={form.control} name="pin" render={({ field }) => (<FormItem><FormLabel>Votre PIN de sécurité</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage/></FormItem>)}/>
                <Button type="submit" className="w-full" disabled={isLoading || isFetchingRate}> {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Confirmer la Conversion </Button>
            </form>
        </Form>
    );
};

const FiatToCrypto = ({ user, balances, fiatCurrencies }: ConversionFlowProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingRate, setIsFetchingRate] = useState(false);
    const [cryptoValue, setCryptoValue] = useState<number | null>(null);
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof fiatToCryptoSchema>>({
        resolver: zodResolver(fiatToCryptoSchema),
        defaultValues: { fiat: 'USD', crypto: 'BTC' },
    });

    const selectedFiat = form.watch('fiat');
    const amountToConvert = form.watch('amount');
    const selectedCrypto = form.watch('crypto');

    const debouncedFetchRate = useCallback(debounce(async (amount: number, fiatSymbol: string, cryptoSymbol: string) => {
        if (amount > 0) {
            setIsFetchingRate(true);
            const result = await getLiveCryptoPrice(cryptoSymbol, fiatSymbol);
            if (result.success && result.price) {
                setCryptoValue(amount / result.price);
            } else { setCryptoValue(null); }
            setIsFetchingRate(false);
        } else { setCryptoValue(null); }
    }, 500), []);

    useEffect(() => {
        if(selectedFiat) debouncedFetchRate(amountToConvert, selectedFiat, selectedCrypto);
    }, [amountToConvert, selectedFiat, selectedCrypto, debouncedFetchRate]);

    const onSubmit = async (values: z.infer<typeof fiatToCryptoSchema>) => {
        setIsLoading(true);
        const result = await convertFiatToCrypto({ userId: user.id, pin: values.pin, fromCurrency: values.fiat, fromAmount: values.amount, toCrypto: values.crypto });
        if (result.success) {
            openAlert({ title: "Achat Réussi", description: `Vous avez acheté de la crypto. Votre portefeuille crypto a été crédité.`, variant: "success" });
            form.reset();
        } else { openAlert({ title: "Erreur d'Achat", description: result.error, variant: "error" }); }
        setIsLoading(false);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="fiat" render={({ field }) => ( <FormItem><FormLabel>Payer avec</FormLabel><FormControl>
<div className="space-y-2">{fiatCurrencies.map(c => (
<label key={c.code} className="flex items-center gap-3 rounded-lg border border-zinc-600 bg-zinc-700 p-3 text-white">
<input type="radio" name="conversion-fiat" value={c.code} checked={field.value === c.code} onChange={() => field.onChange(c.code)} />
<span>{c.code} (Solde: {c.balance})</span>
</label>
))}</div>
</FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} className="bg-zinc-700 border-zinc-600" /></FormControl><FormMessage /></FormItem> )}/>
                <div className="h-10 flex flex-col items-center justify-center text-center">
                    {isFetchingRate ? <Loader2 className="animate-spin"/> : cryptoValue !== null ? (<><ArrowDown className="h-5 w-5 text-zinc-400 mb-1"/><p className="text-lg font-bold text-green-400">≈ {cryptoValue.toFixed(8)} {selectedCrypto}</p></>) : null}
                </div>
                <FormField control={form.control} name="crypto" render={({ field }) => ( <FormItem><FormLabel>Acheter</FormLabel><FormControl>
<div className="space-y-2">{SUPPORTED_CRYPTOS.map(c => (
<label key={c} className="flex items-center gap-3 rounded-lg border border-zinc-600 bg-zinc-700 p-3 text-white">
<input type="radio" name="buy-crypto" value={c} checked={field.value === c} onChange={() => field.onChange(c)} />
<span>{c}</span>
</label>
))}</div>
</FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="pin" render={({ field }) => (<FormItem><FormLabel>Votre PIN de sécurité</FormLabel><FormControl><div className="flex justify-center"><InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP></div></FormControl><FormMessage/></FormItem>)}/>
                <Button type="submit" className="w-full" disabled={isLoading || isFetchingRate}> {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Confirmer l'Achat </Button>
            </form>
        </Form>
    );
};


export function ConversionFlow(props: ConversionFlowProps) {
    return (
        <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
                <CardTitle>Convertir</CardTitle>
                <CardDescription>Échangez entre vos portefeuilles fiat et crypto.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Tabs defaultValue="cryptoToFiat" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="cryptoToFiat">Crypto → Fiat</TabsTrigger>
                        <TabsTrigger value="fiatToCrypto">Fiat → Crypto</TabsTrigger>
                    </TabsList>
                    <TabsContent value="cryptoToFiat" className="pt-6">
                        <CryptoToFiat {...props} />
                    </TabsContent>
                    <TabsContent value="fiatToCrypto" className="pt-6">
                        <FiatToCrypto {...props} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
