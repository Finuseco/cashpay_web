
'use client';

import { AgentHeader } from '@/components/agent/agent-header';
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { AgentFooter } from '@/components/agent/agent-footer';
import { CopyrightFooter } from '@/components/copyright-footer';
import { getAgentSubscription } from '@/lib/actions/agent-application.actions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openAlert } = useAlertDialog();
  const [user, setUser] = useState<any | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'inactive' | 'expired' | 'cancelled' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
        const fetchedUser = await getAuthenticatedUser();
        if (!fetchedUser || (fetchedUser.role !== 'Agent' && fetchedUser.role !== 'Admin')) {
            openAlert({
                title: 'Accès Non Autorisé',
                description: "Vous n'avez pas les permissions nécessaires pour accéder à cette page. Veuillez vous connecter avec un compte agent.",
                variant: 'error',
                onClose: () => router.replace('/login'),
            });
            return;
        }
        setUser(fetchedUser);

        const sub = await getAgentSubscription(fetchedUser.id);
        if (sub && sub.status === 'active' && sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
            setSubscriptionStatus('active');
        } else {
            // Admin role bypasses the active subscription requirement for management purposes
            if (fetchedUser.role === 'Admin') {
                setSubscriptionStatus('active');
            } else {
                setSubscriptionStatus('expired');
            }
        }

        setIsLoading(false);
    };

    const authPaths = [
        '/agent/login',
        '/agent/verify-otp',
        '/agent/auth-check',
    ];

    if (!authPaths.includes(pathname)) {
        checkSession();
    } else {
        setIsLoading(false);
    }
  }, [router, openAlert, pathname]);
  
  const authPaths = [
    '/agent/login',
    '/agent/verify-otp',
    '/agent/auth-check',
  ];

  if (authPaths.includes(pathname)) {
    return <>{children}</>;
  }
  
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (subscriptionStatus !== 'active') {
    return (
       <div className="flex flex-col min-h-screen">
          <AgentHeader agent={user} />
          <main className="flex-1 flex items-center justify-center">
            <div className="container mx-auto p-4 md:p-8 max-w-lg">
              <Alert variant="destructive">
                  <AlertTitle>Abonnement Expiré ou Inactif</AlertTitle>
                  <AlertDescription>
                      Votre accès aux outils de vente est suspendu car votre abonnement d'agent est arrivé à expiration. Vos produits ne sont plus visibles sur le Market JoJo.
                  </AlertDescription>
                  <Button className="mt-4" onClick={() => router.push('/settings')}>
                    Renouveler mon Abonnement
                  </Button>
              </Alert>
            </div>
          </main>
          <CopyrightFooter />
          <AgentFooter />
       </div>
    );
  }

  return (
      <div className="flex flex-col min-h-screen">
        <AgentHeader agent={user} />
        <main className="flex-1 pb-24">
          <div className="container mx-auto p-4 md:p-8">
              {children}
          </div>
        </main>
        <CopyrightFooter />
        <AgentFooter />
      </div>
  );
}
