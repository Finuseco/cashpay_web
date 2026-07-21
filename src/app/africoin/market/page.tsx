
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from "react-i18next";
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AfriCoinHeader } from '../africoin-header';
import { getLiveCryptoPrice } from '@/lib/actions/crypto.actions';
import { ArrowUp, ArrowDown } from 'lucide-react';
import Image from 'next/image';

const SUPPORTED_CRYPTOS = ['BTC', 'ETH', 'USDT_ERC20', 'AFC'];

interface CryptoData {
    name: string;
    symbol: string;
    logo: string;
    price: number;
    change24h: number;
    history: { name: string; value: number }[];
}

const CryptoRow = ({ crypto }: { crypto: CryptoData }) => (
    <TableRow>
        <TableCell>
            <div className="flex items-center gap-3">
                <Image src={crypto.logo} alt={crypto.name} width={32} height={32}/>
                <div>
                    <p className="font-bold">{crypto.name}</p>
                    <p className="text-xs text-zinc-400">{crypto.symbol.replace('_ERC20', '')}</p>
                </div>
            </div>
        </TableCell>
        <TableCell className="w-24 h-12">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={crypto.history}>
                    <Tooltip 
                        contentStyle={{ display: 'none' }}
                        wrapperStyle={{ display: 'none' }}
                    />
                    <Line type="monotone" dataKey="value" stroke={crypto.change24h >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </TableCell>
        <TableCell className="text-right">
            <p className="font-semibold">${crypto.price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
             <div className={`flex items-center justify-end text-xs ${crypto.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {crypto.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                <span>{crypto.change24h.toFixed(2)}%</span>
            </div>
        </TableCell>
    </TableRow>
);


export default function MarketPage() {
    const { t } = useTranslation();
    const [marketData, setMarketData] = useState<CryptoData[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const cryptoDetails: Record<string, { name: string; logo: string; }> = useMemo(() => ({
        'BTC': { name: 'Bitcoin', logo: '/logos/crypto/btc.svg' },
        'ETH': { name: 'Ethereum', logo: '/logos/crypto/eth.svg' },
        'USDT_ERC20': { name: 'Tether', logo: '/logos/crypto/usdt.svg' },
        'AFC': { name: 'AfriCoin', logo: '/logos/crypto/afc.png' }
    }), []);

    useEffect(() => {
        const fetchMarketData = async () => {
            setIsLoading(true);
            const dataPromises = SUPPORTED_CRYPTOS.map(async (symbol) => {
                const priceResult = await getLiveCryptoPrice(symbol, 'USD');
                // Simulate fetching historical data
                const history = Array.from({ length: 10 }, (_, i) => ({
                    name: i.toString(),
                    value: (priceResult.price || 0) * (1 + (Math.random() - 0.5) * 0.1) // Random +/- 5% variation
                }));
                return {
                    name: cryptoDetails[symbol]?.name || symbol,
                    symbol: symbol,
                    logo: cryptoDetails[symbol]?.logo || '',
                    price: priceResult.price || 0,
                    change24h: (Math.random() - 0.5) * 10, // Random +/- 5% change
                    history,
                };
            });

            const allData = await Promise.all(dataPromises);
            setMarketData(allData);
            setIsLoading(false);
        };
        fetchMarketData();
    }, [cryptoDetails]);


    return (
        <>
            <AfriCoinHeader selectedCurrency="Marché"/>
            <div className="p-4 md:p-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Marché des Cryptos</h1>
                    <p className="text-zinc-400">Suivez les tendances du marché en temps réel.</p>
                </div>
                 <Card className="bg-zinc-800 border-zinc-700">
                    <CardContent className="p-0">
                         <Table>
                            <TableHeader>
                                <TableRow className="border-zinc-700">
                                    <TableHead className="text-white">Nom</TableHead>
                                    <TableHead className="text-white text-center">Graphique (24h)</TableHead>
                                    <TableHead className="text-right text-white">Prix</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(4)].map((_, i) => (
                                        <TableRow key={i} className="border-zinc-700">
                                            <TableCell><Skeleton className="h-8 w-24"/></TableCell>
                                            <TableCell><Skeleton className="h-8 w-full"/></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto"/></TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    marketData?.map(crypto => <CryptoRow key={crypto.symbol} crypto={crypto} />)
                                )}
                            </TableBody>
                         </Table>
                    </CardContent>
                 </Card>
            </div>
        </>
    );
}

