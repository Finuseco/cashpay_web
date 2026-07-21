
'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';

export default function CasinoTermsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem('casinoTermsAccepted', 'true');
    router.push('/casino');
  };

  const handleDecline = () => {
    router.push('/dashboard');
  };

  if (!isClient) {
      return (
        <div className="flex h-screen flex-col items-center justify-center bg-zinc-900 p-4">
        </div>
      )
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-zinc-900 p-4">
      <Card className="w-full max-w-2xl bg-zinc-800 text-white border-zinc-700">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('casinoTncTitle')}</CardTitle>
          <CardDescription className="text-zinc-400">{t('casinoTncWarningHeader')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-72 w-full rounded-md border border-zinc-700 bg-zinc-900/50 p-4">
             <div className="space-y-4 text-sm text-zinc-300">
                <p>{t('casinoTncWarningBody')}</p>
                <Separator className="bg-zinc-700" />
                <h3 className="font-bold text-white uppercase">{t('casinoTncAgreementHeader')}</h3>
                <ul className="list-disc space-y-2 pl-5">
                  <li><strong>{t('casinoTncCond1Title')}</strong> {t('casinoTncCond1Body')}</li>
                  <li><strong>{t('casinoTncCond2Title')}</strong> {t('casinoTncCond2Body')}</li>
                  <li><strong>{t('casinoTncCond3Title')}</strong> {t('casinoTncCond3Body')}</li>
                  <li><strong>{t('casinoTncCond4Title')}</strong> {t('casinoTncCond4Body')}</li>
                  <li><strong>{t('casinoTncCond5Title')}</strong> {t('casinoTncCond5Body')}</li>
                </ul>
                <Separator className="bg-zinc-700" />
                <div className="text-center">
                    <p className="font-bold text-red-500 uppercase">{t('casinoTncFinalWarningHeader')}</p>
                    <p className="text-center italic text-zinc-400">{t('casinoTncFinalWarningBody')}</p>
                </div>
                <Separator className="bg-zinc-700" />
                <p className="pt-4 text-xs text-center text-zinc-500">{t('casinoTncAcceptanceStatement')}</p>
              </div>
          </ScrollArea>
        </CardContent>
        <div className="flex flex-col-reverse sm:flex-row gap-3 p-6 pt-0">
          <Button variant="outline" className="w-full" onClick={handleDecline}>{t('casinoTncDeclineButton')}</Button>
          <Button className="w-full bg-yellow-400 text-black hover:bg-yellow-500 font-bold" onClick={handleAccept}>{t('casinoTncAcceptButton')}</Button>
        </div>
      </Card>
    </div>
  );
}
