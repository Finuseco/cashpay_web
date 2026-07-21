'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SportsHeader } from "@/components/sports/sports-header";
import { SportsFooter } from "@/components/sports/sports-footer";
import { BetSlipSheet } from "@/components/sports/bet-slip-sheet";
import type { User, Currency } from "@/lib/types";
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';

function LayoutLoader() {
    return (
        <div className="flex flex-col h-screen bg-[#1e293b]">
            <div className="flex-1 flex items-center justify-center">
                <Skeleton className="h-32 w-32 rounded-full bg-zinc-800" />
            </div>
        </div>
    );
}

function CasinoLayoutContent({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isVerified, setIsVerified] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    
    const cdfBalance = currencies.find(c => c.code === 'CDF')?.balance || '0';

    useEffect(() => {
        const verifyAndFetch = async () => {
             // Prevent redirect loop
            if (pathname === '/casino/terms') {
                setIsVerified(true);
                return;
            }

            const termsAccepted = localStorage.getItem('casinoTermsAccepted') === 'true';
            if (!termsAccepted) {
                router.replace('/casino/terms');
            } else {
                const fetchedUser = await getAuthenticatedUser();
                if (fetchedUser) {
                    setUser(fetchedUser);
                    const fetchedCurrencies = await getUserCurrencies(fetchedUser.id);
                    setCurrencies(fetchedCurrencies);
                }
                setIsVerified(true);
            }
        };
        verifyAndFetch();
    }, [pathname, router]);

    if (!isVerified) {
        return <LayoutLoader />;
    }

    return (
        <div className="flex flex-col h-full bg-[#1e293b] text-zinc-100">
            <SportsHeader user={user} balance={cdfBalance} />
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
            <SportsFooter />
            <BetSlipSheet />
        </div>
    );
}


export default function CasinoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<LayoutLoader />}>
            <CasinoLayoutContent>{children}</CasinoLayoutContent>
        </Suspense>
    );
}
