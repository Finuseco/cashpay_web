

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Currency, CryptoBalance, CryptoTransaction } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCryptoBalances, getCryptoHistory, getLiveCryptoPrice } from '@/lib/actions/crypto.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowUp, ArrowDown, Plus, Repeat, ChevronRight, CandlestickChart, History, Copy } from 'lucide-react';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AfriCoinHeader } from './africoin-header';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const BalanceDisplay = ({ selectedBalance, selectedCurrency, fiatValue }: { selectedBalance: number, selectedCurrency: string, fiatValue: number | null }) => (
    <div className="text-center py-8">
        <p className="text-5xl font-bold">{selectedBalance.toFixed(selectedCurrency === 'AFC' ? 2 : 8)}</p>
        <p className="text-lg font-semibold">{selectedCurrency.replace('_ERC20', '').replace('_TRC20', '')}</p>
        <p className="text-zinc-400 mt-1">
            {fiatValue !== null ? `$${fiatValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <Skeleton className="h-5 w-24 mx-auto" />}
        </p>
    </div>
);

const ActionButton = ({ icon: Icon, label, href }: { icon: React.ElementType, label: string, href: string }) => {
    return (
        <Link href={href} className="flex flex-col items-center gap-2">
            <Button size="icon" className="h-14 w-14 rounded-full bg-[#000e38] hover:bg-[#000e38]/90">
                <Icon className="h-7 w-7" />
            </Button>
            <span className="text-sm font-medium">{label}</span>
        </Link>
    );
};


const InfoRow = ({ icon: Icon, label, value, hasArrow = false, href }: { icon: React.ElementType, label: string, value: React.ReactNode, hasArrow?: boolean, href: string }) => (
    <Link href={href} className="flex items-center justify-between p-4 hover:bg-zinc-800 rounded-lg cursor-pointer">
        <div className="flex items-center gap-4">
            <Icon className="h-5 w-5 text-zinc-400" />
            <span className="font-semibold">{label}</span>
        </div>
        <div className="flex items-center gap-2">
            {value}
            {hasArrow && <ChevronRight className="h-5 w-5 text-zinc-500" />}
        </div>
    </Link>
);


export default function AfriCoinPage() {
    const [user, setUser] = useState<User | null>(null);
    const [balances, setBalances] = useState<CryptoBalance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCurrency, setSelectedCurrency] = useState('AFC');
    const [fiatValue, setFiatValue] = useState<number | null>(null);
    const router = useRouter();

    const logos: Record<string, string> = useMemo(() => ({
        'BTC': '/logos/crypto/btc.svg',
        'ETH': '/logos/crypto/eth.svg',
        'USDT_ERC20': '/logos/crypto/usdt.svg',
        'USDT_TRC20': '/logos/crypto/usdt.svg',
        'AFC': '/logos/crypto/afc.png'
    }), []);
    
    const selectedBalance = useMemo(() => {
        return balances.find(b => b.currency_code === selectedCurrency)?.balance || 0;
    }, [balances, selectedCurrency]);

     useEffect(() => {
        const fetchWalletData = async () => {
            setIsLoading(true);
            const currentUser = await getAuthenticatedUser();
            if (!currentUser) {
                router.push('/login');
                return;
            }
            setUser(currentUser);
            const cryptoBalances = await getCryptoBalances(currentUser.id);
            setBalances(cryptoBalances);
            setIsLoading(false);
        };
        fetchWalletData();
    }, [router]);
    
    useEffect(() => {
        if (selectedCurrency && selectedBalance > 0) {
            setFiatValue(null); // Reset while fetching
            getLiveCryptoPrice(selectedCurrency, 'USD').then(result => {
                if (result.success && result.price) {
                    setFiatValue(selectedBalance * result.price);
                }
            }).catch((error: any) => {
                console.error("Error fetching live crypto price:", error);
            });
        } else if (selectedBalance === 0) {
            setFiatValue(0);
        }
    }, [selectedBalance, selectedCurrency]);

    if (isLoading || !user) {
        return (
            <main className="flex-1 p-4 md:p-8 flex items-center justify-center">
                 <Loader2 className="h-12 w-12 animate-spin text-yellow-400" />
            </main>
        )
    }

    return (
        <div className="flex flex-col h-full">
            <AfriCoinHeader selectedCurrency={selectedCurrency}/>
            <main className="flex-1 p-4">
                <div className="max-w-md mx-auto">
                    <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                        <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 h-14">
                            <SelectValue>
                                <div className="flex items-center gap-3">
                                    <Image src={logos[selectedCurrency] || ''} alt={selectedCurrency} width={32} height={32} />
                                    <span className="text-lg font-semibold">{selectedCurrency.replace('_ERC20','').replace('_TRC20','')}</span>
                                </div>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 text-white border-zinc-700">
                            {balances.map(b => (
                                <SelectItem key={b.currency_code} value={b.currency_code}>
                                    <div className="flex items-center gap-2">
                                        <Image src={logos[b.currency_code] || ''} alt={b.currency_code} width={20} height={20}/>
                                        {b.currency_code.replace('_ERC20', '').replace('_TRC20', '')}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    <BalanceDisplay selectedBalance={selectedBalance} selectedCurrency={selectedCurrency} fiatValue={fiatValue} />

                    <div className="grid grid-cols-4 gap-4 my-8">
                        <ActionButton icon={ArrowUp} label="Envoyer" href="/africoin/send"/>
                        <ActionButton icon={ArrowDown} label="Recevoir" href="/africoin/receive"/>
                        <ActionButton icon={Plus} label="Acheter" href="/africoin/exchange"/>
                        <ActionButton icon={Repeat} label="Échanger" href="/africoin/exchange"/>
                    </div>

                    <div className="divide-y divide-zinc-800 rounded-lg bg-zinc-900/50">
                        <InfoRow 
                            icon={CandlestickChart} 
                            label="Marché" 
                            value={<span className="text-green-400 font-semibold">+2.4%</span>} 
                            hasArrow 
                            href="/africoin/market"
                        />
                        <InfoRow 
                            icon={History} 
                            label="Historique" 
                            value={<span>3 transactions</span>} 
                            hasArrow
                            href="/africoin/history"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}

    