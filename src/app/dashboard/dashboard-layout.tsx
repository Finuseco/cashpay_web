
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from "react-i18next";
import { Loader2 } from 'lucide-react';
import type { User, Currency, Card } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { getCardsForUser } from '@/lib/actions/card.actions';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardFooter } from '@/components/dashboard/dashboard-footer';
import { InAppOtpHandler } from '@/components/in-app-otp-handler';
import { ActionGrid } from './action-grid';
import { CopyrightFooter } from '@/components/copyright-footer';
import { useAlertDialog } from '@/hooks/use-alert-dialog';

export function DashboardLayout({
  children,
  pageTitleKey
}: {
  children: React.ReactNode;
  pageTitleKey?: string;
}) {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUserAndData = async () => {
      const fetchedUser = await getAuthenticatedUser();
      if (!fetchedUser) {
        router.replace('/login');
        return;
      }
      setUser(fetchedUser);

      const [fetchedCurrencies, fetchedCards] = await Promise.all([
        getUserCurrencies(fetchedUser.id),
        getCardsForUser(fetchedUser.id, fetchedUser.full_name)
      ]);
      setCurrencies(fetchedCurrencies);
      setCards(fetchedCards);
      setIsLoading(false);
    };
    fetchUserAndData();
  }, [router, pathname]); // Re-fetch on path change to keep data fresh

  const showActionGrid = pathname === '/dashboard';
  const pageTitle = pageTitleKey ? t(pageTitleKey) : undefined;

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
        <DashboardHeader 
            user={user} 
            currencies={showActionGrid ? currencies : []}
            cards={showActionGrid ? cards : []}
            pageTitle={pageTitle}
        >
          {showActionGrid && <ActionGrid />}
        </DashboardHeader>
        {children}
        <CopyrightFooter />
        <DashboardFooter />
        {user && <InAppOtpHandler userId={user.id} />}
    </div>
  );
}
