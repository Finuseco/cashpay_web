
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from "react-i18next";
import { Loader2, MapPin } from 'lucide-react';
import type { User, Currency, Card } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { getCardsForUser } from '@/lib/actions/card.actions';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardFooter } from '@/components/dashboard/dashboard-footer';
import { InAppOtpHandler } from '@/components/in-app-otp-handler';
import { ActionGrid } from '@/components/dashboard/action-grid';
import { CopyrightFooter } from '../copyright-footer';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { Button } from '../ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { findNearbyAtms } from '@/lib/actions/atm.actions';
import { useFooterStore } from '@/hooks/use-footer-store';
import { cn } from '@/lib/utils';
import Cookies from 'js-cookie';

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
  const { openAlert } = useAlertDialog();
  const { toast } = useToast();
  const { isVisible: isFooterVisible } = useFooterStore();

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      const fetchedUser = await getAuthenticatedUser();
      
      if (!fetchedUser) {
        router.replace('/login');
        return;
      } 
      
      const sessionRaw = sessionStorage.getItem('pin-verified-session');
      let isPinVerified = false;
      if (sessionRaw) {
        try {
          const sessionData = JSON.parse(sessionRaw);
          isPinVerified = sessionData === true; // Or more specific checks
        } catch (e) {
          console.error("Failed to parse PIN session data, forcing re-authentication.", e);
          isPinVerified = false;
        }
      }

      if (!isPinVerified) {
          router.replace(`/auth-check?returnTo=${encodeURIComponent(pathname)}`);
          return;
      }
      
      setUser(fetchedUser);
      
      if (fetchedUser.temp_photo_expires_at) {
          const expiryDate = new Date(fetchedUser.temp_photo_expires_at);
          if (new Date() > expiryDate) {
              openAlert({
                  title: "Mise à Jour Requise",
                  description: "Votre photo de profil temporaire a expiré. Veuillez mettre à jour votre profil avec une photo réelle pour continuer à utiliser nos services.",
                  variant: 'warning',
                  onClose: () => router.push('/profile')
              });
              return; 
          }
      }

      const [fetchedCurrencies, fetchedCards] = await Promise.all([
        getUserCurrencies(fetchedUser.id),
        getCardsForUser(fetchedUser.id, fetchedUser.full_name)
      ]);
      setCurrencies(fetchedCurrencies);
      setCards(fetchedCards);
      setIsLoading(false);
    };
    fetchUser();
  }, [router, openAlert, pathname]);
  
  const showCurrencies = pathname === '/dashboard';
  const pageTitle = pageTitleKey ? t(pageTitleKey) : undefined;

  const handleLocateAtms = () => {
    toast({
        title: 'Recherche de distributeurs...',
        description: 'Veuillez autoriser l\'accès à votre position.'
    });

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const atms = await findNearbyAtms({ latitude, longitude });
        
        if (atms.length > 0) {
            const firstAtm = atms[0];
            openAlert({
                title: 'Distributeur le plus proche',
                description: `${firstAtm.name} - ${firstAtm.address} (${firstAtm.distance} ${firstAtm.distanceUnit}).`,
                variant: 'info'
            });
        } else {
             openAlert({
                title: 'Aucun distributeur trouvé',
                description: 'Aucun distributeur partenaire n\'a été trouvé près de votre position actuelle.',
                variant: 'warning'
            });
        }

    }, (error) => {
        console.error("Geolocation error:", error);
        openAlert({
            title: 'Erreur de géolocalisation',
            description: 'Impossible d\'obtenir votre position. Veuillez vérifier les autorisations de votre navigateur.',
            variant: 'error'
        });
    });
  };

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
            currencies={showCurrencies ? currencies : []}
            cards={showCurrencies ? cards : []}
            pageTitle={pageTitle}
        >
          {showCurrencies && (
            <div className="space-y-4">
              <ActionGrid />
              <div className="text-center">
                  <Button onClick={handleLocateAtms} variant="ghost" className="h-auto p-1 text-primary-foreground/80 hover:text-white">
                      <MapPin className="h-4 w-4 mr-1"/>Localiser un ATM
                  </Button>
              </div>
            </div>
          )}
        </DashboardHeader>
        <div className={cn("pb-24 md:pb-0", isFooterVisible ? "pb-24" : "pb-4")}>
          {children}
        </div>
        <CopyrightFooter />
        <DashboardFooter />
        {user && <InAppOtpHandler userId={user.id} />}
    </div>
  );
}
