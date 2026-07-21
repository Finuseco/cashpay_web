
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import type { User, Currency } from '@/lib/types';
import { Loader2, Bitcoin, QrCode, Copy } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { QRCodeSVG } from 'qrcode.react';
import { getUserCryptoAddresses, handleCryptoDeposit, requestCryptoWithdrawal } from '@/lib/actions/crypto.actions';
import { Skeleton } from '../ui/skeleton';

const withdrawalSchema = z.object({
  amount: z.coerce.number().min(0.0001, "Le montant est trop faible."),
  crypto: z.string({ required_error: "Veuillez sélectionner une cryptomonnaie." }),
  recipientAddress: z.string().min(20, "L'adresse du destinataire est requise."),
});

interface CryptoTransferFormProps {
    user: User;
    type: 'deposit' | 'withdrawal';
    currencies?: Currency[];
}

export function CryptoTransferForm({ user, type, currencies = [] }: CryptoTransferFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingAddress, setIsFetchingAddress] = useState(true);
    const { openAlert } = useAlertDialog();
    const [isSimulating, setIsSimulating] = useState(false);
    
    const [userAddresses, setUserAddresses] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchAddresses = async () => {
            setIsFetchingAddress(true);
            const addresses = await getUserCryptoAddresses(user.id);
            setUserAddresses(addresses);
            setIsFetchingAddress(false);
        };
        fetchAddresses();
    }, [user.id]);
    
    const form = useForm<z.infer<typeof withdrawalSchema>>({
        resolver: zodResolver(withdrawalSchema),
        defaultValues: { crypto: 'BTC' }
    });

    const selectedCrypto = form.watch('crypto') as keyof typeof userAddresses;
    const depositAddress = userAddresses[selectedCrypto] || '';
    
    const handleCopyAddress = () => {
        navigator.clipboard.writeText(depositAddress);
        openAlert({ title: 'Copié !', description: 'L\'adresse de dépôt a été copiée.', variant: 'success' });
    }

    const handleSimulateDeposit = async () => {
        if (!depositAddress) return;
        setIsSimulating(true);

        const simulatedAmount = selectedCrypto === 'BTC' ? 0.005 : (selectedCrypto === 'ETH' ? 0.1 : 100);

        const result = await handleCryptoDeposit({
            userId: user.id,
            currency: selectedCrypto,
            amount: simulatedAmount,
            address: depositAddress
        });
        
        openAlert({
            title: result.success ? 'Simulation Lancée' : 'Erreur de Simulation',
            description: result.message,
            variant: result.success ? 'success' : 'error'
        });
        setIsSimulating(false);
    };

    const onSubmit = async (values: z.infer<typeof withdrawalSchema>) => {
        setIsLoading(true);
        const result = await requestCryptoWithdrawal({
            user,
            amount: values.amount,
            currency: values.crypto,
            recipientAddress: values.recipientAddress,
        });

        if (result.success) {
            openAlert({
                variant: 'success',
                title: 'Demande de Retrait Soumise',
                description: `Votre demande de retrait de ${values.amount} ${values.crypto} a été soumise. Elle sera traitée après les confirmations réseau.`
            });
            form.reset();
        } else {
             openAlert({
                variant: 'error',
                title: 'Erreur de Retrait',
                description: result.error,
            });
        }
        setIsLoading(false);
    };

    if (type === 'deposit') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Dépôt par Cryptomonnaie</CardTitle>
                    <CardDescription>Envoyez la cryptomonnaie de votre choix à l'adresse correspondante pour recharger votre compte fiat.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <FormField
                        control={form.control}
                        name="crypto"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Choisissez une cryptomonnaie</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                                        <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                                        <SelectItem value="USDT_ERC20">Tether (USDT - ERC20)</SelectItem>
                                        <SelectItem value="USDT_TRC20">Tether (USDT - TRC20)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                    {isFetchingAddress ? (
                        <div className="flex flex-col items-center gap-4 p-4">
                           <Skeleton className="h-40 w-40" />
                           <Skeleton className="h-6 w-full" />
                        </div>
                    ) : (
                         <div className="text-center p-4 bg-muted rounded-lg flex flex-col items-center gap-4">
                            <div className="bg-white p-2 rounded-lg inline-block">
                               <QRCodeSVG value={depositAddress} size={160} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold">Votre adresse de dépôt {selectedCrypto}</p>
                                <div className="flex items-center gap-1 mt-1 justify-center">
                                    <p className="font-mono text-xs break-all">{depositAddress}</p>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyAddress}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <p className="text-xs text-center text-muted-foreground">Les fonds seront crédités sur votre portefeuille USD après les confirmations réseau.</p>
                </CardContent>
                 <CardFooter>
                    <Button variant="outline" className="w-full" onClick={handleSimulateDeposit} disabled={isSimulating}>
                        {isSimulating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Simuler un Dépôt de Test
                    </Button>
                </CardFooter>
            </Card>
        );
    }
    
    // Withdrawal form
    return (
        <Card>
            <CardHeader>
                <CardTitle>Retrait en Cryptomonnaie</CardTitle>
                <CardDescription>Transférez vos fonds vers un portefeuille crypto externe.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField control={form.control} name="crypto" render={({ field }) => ( <FormItem><FormLabel>Retirer en</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>
                            <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                            <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                            <SelectItem value="USDT_ERC20">Tether (USDT - ERC20)</SelectItem>
                            <SelectItem value="USDT_TRC20">Tether (USDT - TRC20)</SelectItem>
                        </SelectContent></Select><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="amount" render={({ field }) => ( <FormItem><FormLabel>Montant</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="recipientAddress" render={({ field }) => ( <FormItem><FormLabel>Adresse du destinataire</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        
                        <p className="text-sm text-muted-foreground text-center">Des frais de réseau s'appliqueront et seront déduits du montant envoyé.</p>
                        
                        <Button type="submit" variant="gradient" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Retrait
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
