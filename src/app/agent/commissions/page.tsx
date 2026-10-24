'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Percent, ArrowRightLeft, Wallet, RefreshCw } from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';

const claimSchema = z.object({
    currency: z.string().min(1, 'Devise requise'),
    amount: z.coerce.number().positive('Montant doit être positif'),
    pin: z.string().length(4, 'PIN à 4 chiffres'),
});

type CommissionData = {
    balances: Record<string, number>;
    commissionBalance: Record<string, number>;
};

export default function AgentCommissionsPage() {
    const { openAlert } = useAlertDialog();
    const [data, setData] = useState<CommissionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);

    const form = useForm<z.infer<typeof claimSchema>>({
        resolver: zodResolver(claimSchema),
        defaultValues: { currency: 'USD', amount: 0, pin: '' },
    });

    const fetchCommissions = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/v1/agent/commissions');
            const json = await res.json();
            if (json.success) {
                setData(json);
            }
        } catch {
            // silently ignore
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchCommissions(); }, []);

    const onSubmit = async (values: z.infer<typeof claimSchema>) => {
        setIsClaiming(true);
        try {
            const res = await fetch('/api/v1/agent/commissions/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const json = await res.json();
            if (json.success) {
                openAlert({
                    variant: 'success',
                    title: 'Virement réussi',
                    description: `${values.amount} ${values.currency} transféré vers votre portefeuille.`,
                    onClose: () => fetchCommissions(),
                });
                form.reset({ currency: 'USD', amount: 0, pin: '' });
            } else {
                openAlert({ variant: 'error', title: 'Erreur', description: json.error || 'Virement impossible.' });
                form.setValue('pin', '');
            }
        } catch {
            openAlert({ variant: 'error', title: 'Erreur réseau', description: 'Impossible de contacter le serveur.' });
        } finally {
            setIsClaiming(false);
        }
    };

    const commissionEntries = data ? Object.entries(data.commissionBalance).filter(([, v]) => v > 0) : [];
    const selectedCurrency = form.watch('currency');
    const maxAmount = data?.commissionBalance[selectedCurrency] ?? 0;

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Commissions</h1>
                    <p className="text-muted-foreground">Vos revenus d'agent accumulés.</p>
                </div>
                <Button variant="outline" size="icon" onClick={fetchCommissions} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Soldes commissions */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Percent className="h-5 w-5 text-primary" />
                        Solde de commissions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
                        </div>
                    ) : commissionEntries.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Aucune commission disponible pour le moment.</p>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {commissionEntries.map(([currency, amount]) => (
                                <div key={currency} className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                                    <span className="text-2xl font-black text-primary">{amount.toFixed(2)}</span>
                                    <Badge variant="outline" className="font-bold">{currency}</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Soldes portefeuille */}
            {data && Object.keys(data.balances).length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Wallet className="h-5 w-5 text-primary" />
                            Portefeuille principal
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(data.balances).map(([currency, amount]) => (
                                <div key={currency} className="flex items-center gap-2 bg-muted rounded-xl px-4 py-3">
                                    <span className="text-xl font-bold">{amount.toFixed(2)}</span>
                                    <Badge variant="secondary">{currency}</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Formulaire virement commission → portefeuille */}
            {commissionEntries.length > 0 && (
                <Card className="border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowRightLeft className="h-5 w-5 text-primary" />
                            Récupérer mes commissions
                        </CardTitle>
                        <CardDescription>
                            Transférer vos commissions vers votre portefeuille principal.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                {/* Sélection devise */}
                                <FormField control={form.control} name="currency" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Devise</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex flex-wrap gap-3"
                                            >
                                                {commissionEntries.map(([currency, amount]) => (
                                                    <div key={currency}>
                                                        <RadioGroupItem value={currency} id={`cur-${currency}`} className="sr-only" />
                                                        <Label
                                                            htmlFor={`cur-${currency}`}
                                                            className={`flex flex-col items-center p-3 border-2 rounded-xl cursor-pointer transition-all min-w-[80px] ${
                                                                field.value === currency
                                                                    ? 'border-primary bg-primary/5 text-primary'
                                                                    : 'border-zinc-100 text-zinc-500'
                                                            }`}
                                                        >
                                                            <span className="font-black text-lg">{currency}</span>
                                                            <span className="text-xs">{amount.toFixed(2)} dispo.</span>
                                                        </Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* Montant */}
                                <FormField control={form.control} name="amount" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Montant à récupérer</FormLabel>
                                        <div className="flex gap-2">
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    max={maxAmount}
                                                    className="h-12"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-12 px-3 text-xs font-bold"
                                                onClick={() => form.setValue('amount', maxAmount)}
                                            >
                                                MAX
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Disponible : {maxAmount.toFixed(2)} {selectedCurrency}
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                {/* PIN */}
                                <FormField control={form.control} name="pin" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Code PIN CashPay</FormLabel>
                                        <FormControl>
                                            <div className="flex justify-center">
                                                <InputOTP maxLength={4} value={field.value} onChange={field.onChange}>
                                                    <InputOTPGroup>
                                                        <InputOTPSlot index={0} />
                                                        <InputOTPSlot index={1} />
                                                        <InputOTPSlot index={2} />
                                                        <InputOTPSlot index={3} />
                                                    </InputOTPGroup>
                                                </InputOTP>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <Button
                                    type="submit"
                                    variant="gradient"
                                    className="w-full h-14 font-bold text-lg"
                                    disabled={isClaiming || form.watch('pin').length < 4}
                                >
                                    {isClaiming ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <ArrowRightLeft className="mr-2 h-5 w-5" />}
                                    TRANSFÉRER MES COMMISSIONS
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
