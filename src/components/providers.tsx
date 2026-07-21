

'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { OfflineHandler } from '@/components/offline-handler';
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import { LanguageManager } from '@/components/language-manager';
import { GlobalAlertDialog } from '@/components/global-alert-dialog';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <I18nextProvider i18n={i18n}>
            <LanguageManager />
            <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            >
            {children}
            <GlobalAlertDialog />
            <OfflineHandler />
            </ThemeProvider>
        </I18nextProvider>
    );
}
