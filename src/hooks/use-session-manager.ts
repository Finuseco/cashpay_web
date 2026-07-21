
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/actions/auth.actions';
import { useAlertDialog } from './use-alert-dialog';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes, but effectively disabled for now.

export function useSessionManager() {
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  const inactivityTimer = useRef<NodeJS.Timeout>();

  const handleLogout = useCallback(async () => {
    // This functionality is temporarily disabled to prevent rendering issues.
    // In the future, this should be handled server-side or with a more robust client-side approach.
    return; 
    
    // await logout();
    // openAlert({
    //   variant: 'info',
    //   title: 'Session expirée',
    //   description: 'Vous avez été déconnecté pour inactivité.',
    //   onClose: () => router.push('/login'),
    // });
  }, [router, openAlert]);

  const resetTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(handleLogout, INACTIVITY_TIMEOUT);
  }, [handleLogout]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];

    const eventHandler = () => {
      resetTimer();
    };

    // Set up event listeners to detect user activity
    events.forEach(event => window.addEventListener(event, eventHandler));
    // Initial timer start
    resetTimer();

    // Cleanup function
    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      events.forEach(event => window.removeEventListener(event, eventHandler));
    };
  }, [resetTimer]);

  return null;
}
