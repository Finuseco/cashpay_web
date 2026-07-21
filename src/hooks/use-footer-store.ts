
'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FooterState {
    isVisible: boolean;
    toggleVisibility: () => void;
    setVisibility: (visible: boolean) => void;
}

export const useFooterStore = create<FooterState>()(
    persist(
        (set) => ({
            isVisible: true,
            toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
            setVisibility: (visible) => set({ isVisible: visible }),
        }),
        {
            name: 'footer-visibility-storage', // name of the item in the storage (must be unique)
            storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
        }
    )
);
