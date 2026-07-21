
'use client';

import { useState, useEffect } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCountryRevenueWallet } from '@/lib/actions/super-agent/finance.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Coins, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function SuperAgentDashboard() {
    const [user, setUser] = useState<any>(null);
    const [revenueWallet, setRevenueWallet] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const currentUser = await getAuthenticatedUser();
            setUser(currentUser);
            if (currentUser?.country) {
                const walletData = await getCountryRevenueWallet(currentUser.country);
                setRevenueWallet(walletData);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-48 w-full bg-zinc-800" />
            </div>
        );
    }

    const isNationalAgent = user?.role === 'SuperAgent' || user?.role === 'Admin';

    return (
        <div className="space-y-8 pb-20">
            {/* Header section with Revenue Wallet Info */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Tableau de Bord National</h1>
                    <p className="text-sm text-zinc-400">Juridiction : {user?.country}</p>
                </div>
            </div>

            {isNationalAgent && revenueWallet && (
                 <Card className="relative overflow-hidden bg-zinc-800 border-zinc-700 text-white shadow-2xl">
                    <Wallet className="absolute -right-8 -bottom-8 h-48 w-48 text-white/5 -rotate-12" />
                    <CardHeader className="relative z-10">
                        <CardTitle className="flex items-center gap-3">
                            <Coins className="h-6 w-6 text-primary" /> 
                            Portefeuille de Recettes National
                        </CardTitle>
                        <CardDescription className="text-zinc-400">Suivi des commissions collectées sur le territoire.</CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                            {revenueWallet.balances && Object.entries(revenueWallet.balances).map(([currency, amount]: [string, any]) => (
                                <div key={currency} className="space-y-1">
                                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{currency}</p>
                                    <p className="text-3xl font-black text-primary">
                                        {Number(amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2 items-start">
                <Card className="bg-zinc-800 border-zinc-700 text-white">
                    <CardHeader>
                        <CardTitle>Identité Zone</CardTitle>
                        <CardDescription className="text-zinc-400">Informations de votre juridiction.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between py-2 border-b border-zinc-700">
                            <span className="text-zinc-400">Pays</span>
                            <span className="font-bold">{user?.country}</span>
                        </div>
                         <div className="flex justify-between py-2 border-b border-zinc-700">
                            <span className="text-zinc-400">Rang Administratif</span>
                            <span className="font-bold text-primary">{user?.role}</span>
                        </div>
                        <div className="flex justify-between py-2">
                            <span className="text-zinc-400">ID Portefeuille Personnel</span>
                            <span className="font-mono text-xs">{user?.id_wallet}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-zinc-800 border-zinc-700 text-white">
                    <CardHeader>
                        <CardTitle>Statut Système</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-3">
                            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
                            <p className="text-sm font-bold text-green-500 uppercase tracking-widest">Opérationnel</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
