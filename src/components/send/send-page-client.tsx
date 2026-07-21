
'use client';

import { useState } from 'react';
import type { User, Currency, Country } from "@/lib/types";
import { SendForm } from './send-form';
import { InternationalTransferSendForm } from './international-transfer-send-form';
import { TransferOptions, type TransferTypeOption } from './transfer-options';

interface SendPageClientProps {
    user: User | null;
    currencies: Currency[];
    countries: Country[];
}

export function SendPageClient({ user, currencies, countries }: SendPageClientProps) {
    const [step, setStep] = useState<'selection' | 'form'>('selection');
    const [transferType, setTransferType] = useState<TransferTypeOption | null>(null);

    const handleSelectType = (type: TransferTypeOption) => {
        setTransferType(type);
        setStep('form');
    }

    const handleBack = () => {
        setTransferType(null);
        setStep('selection');
    }

    if (!user) {
        return <div>Chargement...</div>;
    }

    if (step === 'selection') {
        return <TransferOptions onSelect={handleSelectType} />;
    }

    if (step === 'form' && transferType) {
        if (transferType === 'national') {
            return <SendForm user={user} currencies={currencies} onBack={handleBack} />;
        } else {
            return <InternationalTransferSendForm user={user} currencies={currencies} countries={countries} provider={transferType} onBack={handleBack} />;
        }
    }
    
    return null;
}
