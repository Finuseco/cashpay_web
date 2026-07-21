
'use client';

import { useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Loader2 } from 'lucide-react';
import { getUserCryptoAddresses, handleCryptoDeposit } from '@/lib/actions/crypto.actions';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import Image from 'next/image';

const formSchema = z.object({
  crypto: z.string({ required_error: "Veuillez sélectionner une cryptomonnaie." }),
});

interface DepositFlowProps {
    user: User;
}

export function DepositFlow({ user }: DepositFlowProps) {
    const [isFetchingAddress, setIsFetchingAddress] = useState(true);
    const [isSimulating, setIsSimulating] = useState(false);
    const [userAddresses, setUserAddresses] = useState<Record<string, string>>({});
    const { openAlert } = useAlertDialog();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { crypto: 'BTC' }
    });

    useEffect(() => {
        const fetchAddresses = async () => {
            setIsFetchingAddress(true);
            const addresses = await getUserCryptoAddresses(user.id);
            setUserAddresses(addresses);
            setIsFetchingAddress(false);
        };
        fetchAddresses();
    }, [user.id]);
    
    const selectedCrypto = form.watch('crypto');
    const depositAddress = userAddresses[selectedCrypto] || '';
    
    const handleCopyAddress = () => {
        navigator.clipboard.writeText(depositAddress);
        openAlert({ title: 'Copié !', description: 'L\'adresse de dépôt a été copiée.', variant: 'success' });
    };

    const handleSimulateDeposit = async () => {
        if (!depositAddress) return;
        setIsSimulating(true);
        const simulatedAmount = selectedCrypto === 'BTC' ? 0.005 : (selectedCrypto === 'ETH' ? 0.1 : 100);
        const result = await handleCryptoDeposit({ userId: user.id, currency: selectedCrypto, amount: simulatedAmount, address: depositAddress });
        openAlert({ title: result.success ? 'Simulation Lancée' : 'Erreur de Simulation', description: result.message, variant: result.success ? 'success' : 'error' });
        setIsSimulating(false);
    };

    const cryptoOptions = [
        { value: 'BTC', label: 'Bitcoin', icon: '/logos/crypto/btc.svg' },
        { value: 'ETH', label: 'Ethereum', icon: '/logos/crypto/eth.svg' },
        { value: 'USDT_ERC20', label: 'Tether (ERC20)', icon: '/logos/crypto/usdt.svg' },
        { value: 'USDT_TRC20', label: 'Tether (TRC20)', icon: '/logos/crypto/usdt.svg' },
        { value: 'AFC', label: 'AfriCoin', icon: '/logos/crypto/afc.png' },
    ];

    return (
        <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
                <CardTitle>Dépôt par Cryptomonnaie</CardTitle>
                <CardDescription>Envoyez la cryptomonnaie de votre choix à l'adresse correspondante pour recharger votre compte fiat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Form {...form}>
                    <form>
                        <FormField
                            control={form.control}
                            name="crypto"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Choisissez une cryptomonnaie</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="bg-zinc-700 border-zinc-600"><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent className="bg-zinc-800 text-white border-zinc-700">
                                            {cryptoOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    <div className="flex items-center gap-2">
                                                        <Image src={opt.icon} alt={opt.label} width={20} height={20} />
                                                        {opt.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>
                {isFetchingAddress ? (
                    <div className="flex flex-col items-center gap-4 p-4">
                       <Skeleton className="h-40 w-40" />
                       <Skeleton className="h-6 w-full" />
                    </div>
                ) : (
                     <div className="text-center p-4 bg-zinc-900/50 rounded-lg flex flex-col items-center gap-4">
                        <div className="bg-white p-2 rounded-lg inline-block">
                           <QRCodeSVG value={depositAddress} size={160} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Votre adresse de dépôt {selectedCrypto.replace('_ERC20', '').replace('_TRC20', '')}</p>
                            <div className="flex items-center gap-1 mt-1 justify-center">
                                <p className="font-mono text-xs break-all">{depositAddress}</p>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyAddress}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
                <p className="text-xs text-center text-zinc-400">Les fonds seront crédités sur votre portefeuille USD après les confirmations réseau.</p>
            </CardContent>
             <CardFooter>
                <Button variant="outline" className="w-full" onClick={handleSimulateDeposit} disabled={isSimulating || isFetchingAddress}>
                    {isSimulating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Simuler un Dépôt de Test
                </Button>
            </CardFooter>
        </Card>
    );
}
