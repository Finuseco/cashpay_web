
'use client';

import { useState, useEffect } from "react";
import { ExchangeRateCard } from "@/components/exchange/exchange-rate-card";
import { ExchangeForm } from "@/components/exchange/exchange-form";
import type { User, Currency } from "@/lib/types";
import type { ExchangeRate } from "@/lib/actions/exchange.actions";
import { Loader2 } from "lucide-react";

interface ExchangeClientProps {
    user: User | null;
    initialCurrencies: Currency[];
    initialRates: ExchangeRate[];
    localCurrencyCode: string;
}

export function ExchangeClient({ user, initialCurrencies, initialRates, localCurrencyCode }: ExchangeClientProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
            <div className="flex justify-center p-20">
                <Loader2 className="animate-spin text-primary h-8 w-8" />
            </div>
        );
    }

    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <ExchangeRateCard rates={initialRates} />
                <ExchangeForm 
                    user={user} 
                    currencies={initialCurrencies} 
                    initialRates={initialRates} 
                    localCurrencyCode={localCurrencyCode} 
                />
            </div>
        </main>
    );
}
