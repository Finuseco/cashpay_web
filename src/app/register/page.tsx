'use client';

import { useEffect, useState } from 'react';
import { RegisterForm } from '@/components/auth/register-form';
import { Separator } from '@/components/ui/separator';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function RegisterPage() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-zinc-900">
        <div className="w-full max-w-md bg-zinc-800 h-[400px] animate-pulse rounded-2xl" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-8 bg-zinc-900">
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-br from-orange-600 to-orange-500 rounded-b-[3rem] md:rounded-b-[4rem]" />
      
      <div className="w-full max-w-md z-10 my-auto">
        <RegisterForm />
      </div>

       <footer className="w-full max-w-md z-10 mt-auto py-4">
          <Separator className="my-4 bg-white/20" />
          <div className="text-center text-xs text-white/70 w-full">
            <p>{t('copyrightText', { year: new Date().getFullYear() })} {t('copyrightAllRightsReserved')}</p>
            <div className="mt-2 flex gap-4 justify-center items-center">
                <Link href="#" className="hover:text-white">{t('loginTermsAndConditions', 'Terms & Conditions')}</Link>
                <Separator orientation="vertical" className="h-4 bg-white/50" />
                <a href="https://developer.cashpay-all.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">{t('loginDevelopers', 'Developers')}</a>
                <Separator orientation="vertical" className="h-4 bg-white/50" />
                <LanguageSwitcher />
            </div>
          </div>
      </footer>
    </main>
  );
}
