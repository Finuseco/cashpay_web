
'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';
import { Check, ShieldAlert, Users, PersonStanding } from 'lucide-react';
import { NetOnLogo } from './neton-logo';

export function CinemaTermsClient() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleProfileSelect = (profileType: 'kids' | 'adults') => {
    localStorage.setItem('cinemaProfile', profileType);
    router.push('/cinema/splash');
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-black p-4">
      <Card className="w-full max-w-2xl bg-zinc-900 text-white border-zinc-700">
        <CardHeader className="text-center items-center">
          <NetOnLogo />
          <CardDescription className="text-zinc-400 pt-2">{isClient ? t('cinemaTncWarningHeader', 'Veuillez lire attentivement avant de continuer') : 'Veuillez lire attentivement avant de continuer'}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72 w-full rounded-md border border-zinc-700 bg-zinc-800/50 p-4">
             <div className="space-y-4 text-sm text-zinc-300">
                <div className="flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-yellow-400 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="font-bold text-white uppercase">{t('cinemaTncAgreementHeader', 'Engagement de l\'Utilisateur')}</h3>
                        <p>{t('cinemaTncWarningBody', 'L\'accès aux contenus de NetOn.tv est soumis à des restrictions d\'âge. En continuant, vous confirmez que vous respecterez ces règles.')}</p>
                    </div>
                </div>
                <Separator className="bg-zinc-700" />
                <ul className="space-y-3 pl-2">
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>{t('cinemaTncCond1Title', 'Contenus Protégés :')}</strong> {t('cinemaTncCond1Body', 'Tous les films et séries sont protégés par le droit d\'auteur. Toute reproduction ou distribution non autorisée est illégale.')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>{t('cinemaTncCond2Title', 'Service d\'Abonnement :')}</strong> {t('cinemaTncCond2Body', 'L\'accès au contenu nécessite un abonnement mensuel actif. Les frais ne sont pas remboursables.')}</span>
                  </li>
                   <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span><strong>{t('cinemaTncCond3Title', 'Responsabilité parentale :')}</strong> {t('cinemaTncCond3Body', 'Les parents ou tuteurs sont responsables de superviser l\'accès des enfants à l\'espace "Enfants".')}</span>
                  </li>
                </ul>
                <Separator className="bg-zinc-700" />
                <p className="pt-4 text-base text-center font-bold text-white">{t('cinemaTncAcceptanceStatement', 'Qui regardera ?')}</p>
              </div>
          </ScrollArea>
        </CardContent>
        <div className="flex flex-col sm:flex-row gap-4 p-6 pt-0">
          <Button className="w-full h-24 text-lg bg-blue-600 hover:bg-blue-700" onClick={() => handleProfileSelect('kids')}>
            <Users className="mr-4 h-8 w-8"/> Espace Enfants
          </Button>
          <Button className="w-full h-24 text-lg bg-red-600 hover:bg-red-700 font-bold" onClick={() => handleProfileSelect('adults')}>
            <PersonStanding className="mr-4 h-8 w-8"/> Espace Adultes
          </Button>
        </div>
      </Card>
    </div>
  );
}
