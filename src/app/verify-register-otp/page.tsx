

'use client';

import { Suspense } from 'react';
import { VerifyRegisterOtpForm } from '@/components/auth/verify-register-otp-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

function VerifyRegisterOtpPageLoading() {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-8 bg-zinc-900">
             <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-br from-orange-600 to-orange-500 rounded-b-[3rem] md:rounded-b-[4rem]" />
            <div className="w-full max-w-md z-10 my-auto">
                 <Skeleton className="h-[400px] w-full rounded-lg" />
            </div>
             <footer className="w-full max-w-md z-10 mt-auto py-4">
                <Separator className="my-4 bg-white/20" />
                <p className="text-center text-xs text-white/70">Chargement...</p>
            </footer>
        </main>
    );
}

function VerifyRegisterOtpPageContent() {
  const { t } = useTranslation();
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-8 bg-zinc-900">
       <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-br from-orange-600 to-orange-500 rounded-b-[3rem] md:rounded-b-[4rem]" />
      <div className="w-full max-w-md z-10 my-auto">
        <VerifyRegisterOtpForm />
      </div>
       <footer className="w-full max-w-md z-10 mt-auto py-4">
          <Separator className="my-4 bg-white/20" />
          <div className="text-center text-xs text-white/70 w-full">
            <p>{t('copyrightText', { year: new Date().getFullYear() })} {t('copyrightAllRightsReserved')}</p>
            <div className="mt-2 flex gap-4 justify-center items-center">
                <Link href="#" className="hover:text-white">{t('loginTermsAndConditions', 'Terms & Conditions')}</Link>
                <Separator orientation="vertical" className="h-4 bg-white/50" />
                <Link href="/developer" className="hover:text-white">{t('loginDevelopers', 'Developers')}</Link>
                <Separator orientation="vertical" className="h-4 bg-white/50" />
                <LanguageSwitcher />
            </div>
          </div>
      </footer>
    </main>
  );
}

export default function VerifyRegisterOtpPage() {
  return (
    <Suspense fallback={<VerifyRegisterOtpPageLoading />}>
      <VerifyRegisterOtpPageContent />
    </Suspense>
  );
}
