'use client';

import { FeedbackClient } from '@/components/feedback/feedback-client';
import { Suspense } from 'react';
import { OnChatLandingPage } from '@/components/feedback/onchat-landing-page';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { useEffect, useState } from 'react';

export default function FeedbackPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getAuthenticatedUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    // You can return a loading spinner here if you want
    return null; 
  }

  return (
    <Suspense>
      {isAuthenticated ? <FeedbackClient /> : <OnChatLandingPage />}
    </Suspense>
  );
}
