
'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { checkMpesaTransactionStatus } from '@/lib/actions/transaction.actions';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { useTranslation } from 'react-i18next';

type PaymentStatus = 'initiating' | 'pending_confirmation' | 'success' | 'failed' | 'timeout';

interface DepositStatusDialogProps {
    open: boolean;
    reference: string | null;
    onClose: () => void;
    onSuccess: () => void;
}

const AnimatedCircles = () => (
    <div className="flex justify-center items-center gap-3 py-8">
        <motion.div 
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: 0 }}
            className="h-4 w-4 rounded-full bg-[#000E38]" 
        />
        <motion.div 
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }}
            className="h-4 w-4 rounded-full bg-[#FF6600]" 
        />
        <motion.div 
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5, delay: 1 }}
            className="h-4 w-4 rounded-full bg-zinc-300 border border-zinc-400" 
        />
    </div>
);

export function DepositStatusDialog({ open, reference, onClose, onSuccess }: DepositStatusDialogProps) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<PaymentStatus>('initiating');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        
        if (open && reference && (status === 'initiating' || status === 'pending_confirmation')) {
            interval = setInterval(async () => {
                setTimer(prev => prev + 3);
                
                if (timer > 180) {
                    setStatus('timeout');
                    clearInterval(interval);
                    return;
                }

                try {
                    const result = await checkMpesaTransactionStatus(reference);
                    if (result.success && result.message.includes('Completed')) {
                        setStatus('success');
                        clearInterval(interval);
                        setTimeout(() => {
                            onSuccess();
                        }, 3000);
                    } else if (result.message.includes('Failed') || result.message.includes('Cancelled')) {
                        setStatus('failed');
                        setErrorMessage(result.message);
                        clearInterval(interval);
                    } else {
                        setStatus('pending_confirmation');
                    }
                } catch (e) {
                    console.error("Polling error:", e);
                }
            }, 3000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [open, reference, status, timer, onSuccess]);

    const renderContent = () => {
        switch (status) {
            case 'initiating':
            case 'pending_confirmation':
                return (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-4"
                    >
                        <AnimatedCircles />
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-foreground">{t('depositStatusValidating')}</h3>
                            <p className="text-sm text-muted-foreground px-6">
                                {t('depositStatusInstructions')}
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest pt-4">
                            <ShieldCheck className="h-4 w-4" /> {t('depositStatusSecure')}
                        </div>
                    </motion.div>
                );
            case 'success':
                return (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-4 py-6"
                    >
                        <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="h-12 w-12 text-green-600" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-2xl font-black text-green-600">{t('depositStatusSuccessTitle')}</h3>
                            <p className="text-sm text-zinc-500">{t('depositStatusSuccessDesc')}</p>
                        </div>
                        <p className="text-xs text-zinc-400 animate-pulse">{t('depositStatusRedirecting')}</p>
                    </motion.div>
                );
            case 'failed':
                return (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-4 py-6"
                    >
                        <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                            <XCircle className="h-12 w-12 text-red-600" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-red-600">{t('depositStatusFailedTitle')}</h3>
                            <p className="text-sm text-zinc-500">{errorMessage || t('depositFailedMessage')}</p>
                        </div>
                        <Button onClick={onClose} variant="outline" className="w-full mt-4">{t('depositStatusCloseRetry')}</Button>
                    </motion.div>
                );
            case 'timeout':
                return (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-4 py-6"
                    >
                        <div className="h-20 w-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                            <AlertCircle className="h-12 w-12 text-amber-600" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-amber-600">{t('depositStatusTimeoutTitle')}</h3>
                            <p className="text-sm text-zinc-500">{t('depositStatusTimeoutDesc')}</p>
                        </div>
                        <div className="flex flex-col gap-2 pt-4">
                            <Button onClick={() => setStatus('pending_confirmation')} variant="default">{t('depositStatusContinueWaiting')}</Button>
                            <Button onClick={onClose} variant="ghost">{t('depositStatusCheckLater')}</Button>
                        </div>
                    </motion.div>
                );
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && status !== 'success' && status !== 'initiating' && onClose()}>
            <DialogContent className="max-w-[320px] sm:max-w-md p-6 overflow-hidden rounded-2xl border-none shadow-2xl">
                <div className="flex justify-center mb-2">
                    <Logo className="w-32" />
                </div>
                <AnimatePresence mode="wait">
                    {renderContent()}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}
