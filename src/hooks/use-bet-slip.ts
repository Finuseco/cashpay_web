"use client";

import { create } from 'zustand';
import type { BetSelection } from '@/lib/types';

interface BetSlipState {
  selections: BetSelection[];
  open: boolean;
  setOpen: (open: boolean) => void;
  addBet: (selection: BetSelection) => void;
  removeBet: (selectionId: string) => void;
  clearBets: () => void;
}

export const useBetSlip = create<BetSlipState>((set) => ({
  selections: [],
  open: false,
  setOpen: (open) => set({ open }),
  addBet: (selection) => set((state) => ({ selections: [...state.selections, selection] })),
  removeBet: (selectionId) => set((state) => ({
    selections: state.selections.filter((s) => s.id !== selectionId),
  })),
  clearBets: () => set({ selections: [] }),
}));
