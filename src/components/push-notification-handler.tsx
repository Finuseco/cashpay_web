
'use client';

import { useEffect } from 'react';

// This component now handles the registration of the Service Worker.
// The service worker itself ('/sw.js') will listen for push events.
export function PushNotificationHandler() {
    useEffect(() => {
        if ('serviceWorker' in navigator && typeof window !== 'undefined') {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(
                    function (registration) {
                        console.log('Service Worker registration successful with scope: ', registration.scope);
                    },
                    function (err) {
                        console.log('Service Worker registration failed: ', err);
                    }
                );
            });
        }
    }, []);

    return null; // This component does not render anything
}
