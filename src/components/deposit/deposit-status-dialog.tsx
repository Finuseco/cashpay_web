
'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { useTranslation } from 'react-i18next';

type PaymentStatus = 'pending_confirmation' | 'success' | 'failed';

interface DepositStatusDialogProps {
    open: boolean;
    reference: string | null;
    instructions: string | null;
    onClose: () => void;
    onSuccess: () => void;
    checkStatusAction: (reference: string) => Promise<{success: boolean, status: string, message: string}>;
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

export function DepositStatusDialog({ open, reference, instructions, onClose, onSuccess, checkStatusAction }: DepositStatusDialogProps) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<PaymentStatus>('pending_confirmation');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        if (open) {
            setStatus('pending_confirmation');
            setErrorMessage(null);
        }
    }, [open]);

    const handleCheckStatus = async () => {
        if (!reference) return;

        setIsChecking(true);
        setErrorMessage(null);

        try {
            const result = await checkStatusAction(reference);
            if (result.success && result.status.toLowerCase() === 'completed') {
                setStatus('success');
            } else if (result.status.toLowerCase() === 'failed') {
                setStatus('failed');
                setErrorMessage(result.message || t('depositFailedMessage'));
            } else { // Still Pending
                 setErrorMessage(result.message || t('depositStatusStillPending'));
            }
        } catch (e: any) {
            setStatus('failed');
            setErrorMessage(e.message || t('depositFailedMessage'));
        } finally {
            setIsChecking(false);
        }
    };
    
    useEffect(() => {
        if (status === 'success') {
            const timer = setTimeout(() => onSuccess(), 1500);
            return () => clearTimeout(timer);
        }
    }, [status, onSuccess]);

    const renderContent = () => {
        switch (status) {
            case 'pending_confirmation':
                return (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4">
                        <AnimatedCircles />
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-foreground">{t('depositStatusValidating')}</h3>
                            {instructions ? (
                                <div className="p-4 bg-primary/5 rounded-lg text-sm text-primary-foreground">
                                    <p className="font-bold mb-2">{t('paymentInstructions')}</p>
                                    <p className="text-base font-mono bg-background/50 p-3 rounded-md">{instructions}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground px-6">{t('depositStatusInstructions')}</p>
                            )}
                        </div>
                        <div className="pt-4 flex flex-col gap-2">
                            <Button onClick={handleCheckStatus} disabled={isChecking}>
                                {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {t('depositStatusCheckButton')}
                            </Button>
                             {errorMessage && (
                                <p className="text-xs text-yellow-600 flex items-center justify-center gap-2"><Info className="h-4 w-4"/> {errorMessage}</p>
                            )}
                            <Button onClick={onClose} variant="ghost" size="sm">{t('depositStatusCancel')}</Button>
                        </div>
                    </motion.div>
                );
            case 'success':
                return (
                    <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 py-6">
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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 py-6">
                        <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                            <XCircle className="h-12 w-12 text-red-600" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-red-600">{t('depositStatusFailedTitle')}</h3>
                            <p className="text-sm text-zinc-500">{errorMessage || t('depositFailedMessage')}</p>
                        </div>
                        <div className="pt-4 flex flex-col gap-2">
                            <Button onClick={handleCheckStatus} disabled={isChecking}>
                                {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {t('depositStatusRetryCheck')}
                            </Button>
                            <Button onClick={onClose} variant="outline">{t('depositStatusClose')}</Button>
                        </div>
                    </motion.div>
                );
            default: return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-md p-6 overflow-hidden rounded-2xl border-none shadow-2xl">
                <div className="flex justify-center mb-2">
                    <Logo className="w-32" />
                </div>
                <AnimatePresence mode="wait">
                    <div key={status}>
                        {renderContent()}
                    </div>
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
}
