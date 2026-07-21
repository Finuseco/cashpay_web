
// src/app/africoin/receive/page.tsx
'use client';
import { AfriCoinHeader } from '../africoin-header';
import { DepositFlow } from '@/components/crypto/deposit-flow';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { useEffect, useState } from 'react';
import type { User } from '@/lib/types';
import { Loader2 } from 'lucide-react';


export default function ReceiveCryptoPage() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
            setIsLoading(false);
        }
        fetchUser();
    }, []);

    return (
        <>
            <AfriCoinHeader selectedCurrency="Recevoir" />
            <main className="p-4">
                 <div className="max-w-md mx-auto">
                    {isLoading ? <Loader2 className="animate-spin" /> : user ? <DepositFlow user={user} /> : <p>Veuillez vous connecter.</p>}
                 </div>
            </main>
        </>
    );
}
