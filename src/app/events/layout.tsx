'use client';

import { useEffect, useState } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { getCardsForUser } from '@/lib/actions/card.actions';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardFooter } from '@/components/dashboard/dashboard-footer';
import { CopyrightFooter } from '@/components/copyright-footer';
import type { User, Currency, Card } from '@/lib/types';

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const authenticatedUser = await getAuthenticatedUser();

        if (!authenticatedUser) {
          if (!cancelled) {
            setChecked(true);
          }
          return;
        }

        const [userCurrencies, userCards] = await Promise.all([
          getUserCurrencies(authenticatedUser.id),
          getCardsForUser(
            authenticatedUser.id,
            authenticatedUser.full_name
          ),
        ]);

        if (!cancelled) {
          setUser(authenticatedUser);
          setCurrencies(userCurrencies);
          setCards(userCards);
          setChecked(true);
        }
      } catch (error) {
        console.error('Erreur chargement navigation Events:', error);

        if (!cancelled) {
          setChecked(true);
        }
      }
    };

    loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) {
    return <>{children}</>;
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader
        user={user}
        currencies={[]}
        cards={[]}
      />

      <div className="flex-1 pb-24 md:pb-0">
        {children}
      </div>

      <CopyrightFooter />
      <DashboardFooter />
    </div>
  );
}
