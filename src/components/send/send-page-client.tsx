
'use client';

import { useState } from 'react';
import type { User, Currency, Country } from "@/lib/types";
import { SendForm } from './send-form';
import { InternationalTransferSendForm } from './international-transfer-send-form';
import { TransferOptions, type TransferTypeOption } from './transfer-options';
import { motion, AnimatePresence } from 'framer-motion';

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
        return null;
    }

    return (
        <div className="w-full max-w-lg mx-auto">
            <AnimatePresence mode="wait">
                {step === 'selection' ? (
                    <motion.div
                        key="selection"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <TransferOptions onSelect={handleSelectType} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        {transferType === 'national' ? (
                            <SendForm user={user} currencies={currencies} onBack={handleBack} />
                        ) : (
                            transferType && <InternationalTransferSendForm user={user} currencies={currencies} countries={countries} provider={transferType} onBack={handleBack} />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
