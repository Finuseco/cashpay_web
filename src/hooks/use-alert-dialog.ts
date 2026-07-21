
"use client";

import { create } from 'zustand';
import type { ReactNode } from 'react';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info' | 'destructive';

interface AlertDialogState {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  variant: AlertVariant;
  showCancel?: boolean;
  cancelText?: string;
  confirmText?: string;
  onClose?: (confirmed: boolean) => void;
  openAlert: (config: { 
    title: string; 
    description: ReactNode; 
    variant?: AlertVariant;
    showCancel?: boolean;
    cancelText?: string;
    confirmText?: string;
    onClose?: (confirmed: boolean) => void 
  }) => void;
  closeAlert: (confirmed: boolean) => void;
}

export const useAlertDialog = create<AlertDialogState>((set) => ({
  isOpen: false,
  title: '',
  description: '',
  variant: 'info',
  showCancel: false,
  cancelText: 'Annuler',
  confirmText: 'OK',
  onClose: undefined,
  openAlert: (config) => set({ 
    isOpen: true, 
    title: config.title, 
    description: config.description, 
    variant: config.variant || 'info', 
    showCancel: config.showCancel || false,
    cancelText: config.cancelText || 'Annuler',
    confirmText: config.confirmText || 'OK',
    onClose: config.onClose 
  }),
  closeAlert: (confirmed) => set((state) => {
    if (state.onClose) {
        state.onClose(confirmed);
    }
    return { isOpen: false, title: '', description: '', variant: 'info', showCancel: false, onClose: undefined };
  }),
}));
