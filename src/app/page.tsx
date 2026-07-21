
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SplashScreen } from '@/components/splash-screen';
import Cookies from 'js-cookie';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const refCode = searchParams.get('ref');

    const checkAuthAndRedirect = async () => {
      // We add a small delay to let the splash screen show
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const token = Cookies.get('cashpay-token');
      
      if (refCode) {
        // If there's a referral code, always go to the referral page
        router.replace(`/referral/${refCode}`);
      } else if (token) {
        // If logged in and no referral, go to PIN lock
        router.replace('/auth-check');
      } else {
        // Otherwise, start the full login flow.
        router.replace('/login');
      }
    };

    checkAuthAndRedirect();
  }, [router, searchParams]);

  return <SplashScreen />;
}
