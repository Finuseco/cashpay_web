
// src/app/africoin/exchange/page.tsx
'use client';
import { AfriCoinHeader } from '../africoin-header';
import { ConversionFlow } from '@/components/crypto/conversion-flow';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCryptoBalances } from '@/lib/actions/crypto.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { useEffect, useState } from 'react';
import type { User, CryptoBalance, Currency } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function ExchangeCryptoPage() {
    const [user, setUser] = useState<User | null>(null);
    const [balances, setBalances] = useState<CryptoBalance[]>([]);
    const [fiatCurrencies, setFiatCurrencies] = useState<Currency[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        const fetchData = async () => {
            const fetchedUser = await getAuthenticatedUser();
            if(fetchedUser) {
                setUser(fetchedUser);
                const [cryptoBalances, fiat] = await Promise.all([
                    getCryptoBalances(fetchedUser.id),
                    getUserCurrencies(fetchedUser.id)
                ]);
                setBalances(cryptoBalances);
                setFiatCurrencies(fiat);
            }
            setIsLoading(false);
        }
        fetchData();
    }, []);

    return (
        <>
            <AfriCoinHeader selectedCurrency="Échanger" />
            <main className="p-4">
                 <div className="max-w-md mx-auto">
                    {isLoading ? <Loader2 className="animate-spin" /> : user ? <ConversionFlow user={user} balances={balances} fiatCurrencies={fiatCurrencies} /> : <p>Veuillez vous connecter.</p>}
                 </div>
            </main>
        </>
    );
}
