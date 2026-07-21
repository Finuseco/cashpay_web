
'use client';

import { useState } from "react";
import { ExchangeRateCard } from "@/components/exchange/exchange-rate-card";
import { ExchangeForm } from "@/components/exchange/exchange-form";
import type { User, Currency } from "@/lib/types";
import type { ExchangeRate } from "@/lib/actions/exchange.actions";

interface ExchangeClientProps {
    user: User | null;
    initialCurrencies: Currency[];
    initialRates: ExchangeRate[];
    localCurrencyCode: string | null;
}

export function ExchangeClient({ user, initialCurrencies, initialRates, localCurrencyCode }: ExchangeClientProps) {
    const [currencies, setCurrencies] = useState(initialCurrencies);
    const [exchangeRates, setExchangeRates] = useState(initialRates);
  
    // This function can be used to update the currencies after a successful exchange
    // without a full page reload, though a reload is often simplest.
    const onExchangeSuccess = (updatedCurrencies: Currency[]) => {
      setCurrencies(updatedCurrencies);
    };

    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-8">
                <ExchangeRateCard rates={exchangeRates} />
                <ExchangeForm user={user} currencies={currencies} initialRates={exchangeRates} localCurrencyCode={localCurrencyCode} />
            </div>
        </main>
    );
}
