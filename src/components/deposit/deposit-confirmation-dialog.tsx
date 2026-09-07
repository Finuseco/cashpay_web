
'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface DepositConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  details: {
    amount: number;
    currency: string;
    fee: number;
    total: number;
  } | null;
  isConfirming: boolean;
}

export function DepositConfirmationDialog({ isOpen, onClose, onConfirm, details, isConfirming }: DepositConfirmationDialogProps) {
  const { t } = useTranslation();

  if (!details) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="sm:max-w-[425px]">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <DialogHeader>
                <DialogTitle>{t('confirmDepositTitle', 'Confirmer votre dépôt')}</DialogTitle>
                <DialogDescription>{t('confirmDepositDescription', 'Veuillez vérifier les détails de votre transaction.')}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('depositAmountLabel')}</span>
                  <span className="font-bold">{details.amount.toFixed(2)} {details.currency}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t('transactionFeeLabel', 'Frais de transaction')}</span>
                  <span className="font-bold">{details.fee.toFixed(2)} {details.currency}</span>
                </div>
                <div className="border-t my-2"></div>
                <div className="flex justify-between items-center text-lg">
                  <span className="font-bold">{t('totalToPayLabel', 'Total à payer')}</span>
                  <span className="font-black text-primary">{details.total.toFixed(2)} {details.currency}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={isConfirming}>{t('cancel')}</Button>
                <Button onClick={onConfirm} disabled={isConfirming}>
                  {isConfirming ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  {t('confirmAndProceed', 'Confirmer et procéder')}
                </Button>
              </DialogFooter>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
