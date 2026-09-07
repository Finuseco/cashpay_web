
'use client';

import React, { createContext, useContext } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NotificationContextType {
    notify: (config: { title: string; description: string; status: 'success' | 'error' | 'info' }) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { toast } = useToast();

    const notify = ({ title, description, status }: { title: string; description: string; status: 'success' | 'error' | 'info' }) => {
        toast({
            title,
            description,
            variant: status === 'error' ? 'destructive' : 'success',
        });
    };

    return (
        <NotificationContext.Provider value={{ notify }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) throw new Error("useNotification must be used within a NotificationProvider");
    return context;
}
