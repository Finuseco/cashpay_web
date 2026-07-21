
'use client';

import { useEffect, useRef } from 'react';
import { useTranslation } from "react-i18next";
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/actions/auth.actions';

export function OfflineHandler() {
  const { openAlert } = useAlertDialog();
  const { t } = useTranslation();
  const router = useRouter();
  const wasOffline = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      if (wasOffline.current) {
        wasOffline.current = false;
        openAlert({
          title: t('onlineToastTitle', 'Back Online'),
          description: t('onlineToastDescription', 'Your internet connection has been restored.'),
          variant: 'success',
        });
      }
    };

    const handleOffline = async () => {
      if (!wasOffline.current) {
        wasOffline.current = true;
        // Déconnecter l'utilisateur
        await logout();
        openAlert({
          title: t('offlineToastTitle', 'Connection Lost'),
          description: t('offlineToastDescription', 'You have been logged out for security reasons.'),
          variant: 'warning',
          onClose: () => router.push('/login'),
        });
      }
    };
    
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      wasOffline.current = true;
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [t, openAlert, router]);

  return null;
}
