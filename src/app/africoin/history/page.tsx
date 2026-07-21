
// src/app/africoin/history/page.tsx
'use client';
import { AfriCoinHeader } from '../africoin-header';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCryptoHistory } from '@/lib/actions/crypto.actions';
import { useEffect, useState } from 'react';
import type { User, CryptoTransaction } from '@/lib/types';
import { Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function HistoryCryptoPage() {
    const [user, setUser] = useState<User | null>(null);
    const [history, setHistory] = useState<CryptoTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const fetchedUser = await getAuthenticatedUser();
            if(fetchedUser) {
                setUser(fetchedUser);
                const fetchedHistory = await getCryptoHistory(fetchedUser.id);
                setHistory(fetchedHistory);
            }
            setIsLoading(false);
        }
        fetchData();
    }, []);

    return (
        <>
            <AfriCoinHeader selectedCurrency="Historique" />
            <main className="p-4">
                 <Card className="bg-zinc-800 border-zinc-700 text-white">
                    <CardHeader>
                        <CardTitle>Historique des Transactions Crypto</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Loader2 className="animate-spin" /> : (
                            <div className="space-y-3">
                                {history.map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-md">
                                        <div className="flex items-center gap-3">
                                            {tx.type === 'deposit' ? <ArrowDownLeft className="h-5 w-5 text-green-400"/> : <ArrowUpRight className="h-5 w-5 text-red-400"/>}
                                            <div>
                                                <p className="font-semibold capitalize">{tx.type === 'deposit' ? 'Dépôt' : 'Retrait'} de {tx.currency_code}</p>
                                                <p className="text-xs text-zinc-400">{format(new Date(tx.created_at), 'd MMM yyyy, HH:mm', {locale: fr})}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold ${tx.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>
                                                {tx.type === 'deposit' ? '+' : '-'} {tx.amount.toFixed(8)} {tx.currency_code.replace('_ERC20','')}
                                            </p>
                                            <p className="text-xs text-zinc-500 font-mono truncate max-w-[100px]">{tx.tx_hash}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                 </Card>
            </main>
        </>
    );
}
