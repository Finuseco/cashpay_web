'use client';

import * as React from 'react';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { CompleteProfileForm } from '@/components/auth/complete-profile-form';
import { Logo } from '@/components/logo';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

function Header() {
    return (
        <header className="w-full bg-[#000E38] h-20 flex items-center justify-between px-6 md:px-12 fixed top-0 left-0 right-0 z-50 shadow-lg border-b border-white/5">
            <Logo />
            <div className="flex items-center gap-4">
                <LanguageSwitcher />
            </div>
        </header>
    );
}

function Footer() {
    const { t } = useTranslation();
    const year = new Date().getFullYear();
    return (
        <footer className="w-full max-w-5xl mx-auto py-12 px-6 text-center space-y-6">
            <Separator className="bg-[#000E38]/10" />
            <div className="flex justify-center gap-8 text-[11px] font-black uppercase tracking-widest text-[#000E38]/60">
                <Link href="#" className="hover:text-[#FF6600] transition-colors">{t('loginTermsAndConditions')}</Link>
                <Link href="#" className="hover:text-[#FF6600] transition-colors">{t('loginDevelopers')}</Link>
            </div>
            <p className="text-[10px] font-bold text-zinc-400">
                © {year} FINUSECO SARL. {t('copyrightAllRightsReserved')}
            </p>
        </footer>
    );
}

function CompleteProfilePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [params, setParams] = useState<{
      phone: string;
      countryCode: string;
      countryName: string;
      province: string;
      referralCode: string | null;
      lang: string;
  } | null>(null);

  useEffect(() => {
      const p = searchParams.get("phone");
      const c = searchParams.get("country");
      const cn = searchParams.get("countryName");
      const prov = searchParams.get("province");
      
      if (!p || !c) {
          router.replace('/register');
          return;
      }

      setParams({
          phone: p,
          countryCode: c,
          countryName: cn || 'N/A',
          province: prov || '',
          referralCode: searchParams.get("ref"),
          lang: searchParams.get("lang") || 'fr'
      });
  }, [searchParams, router]);

  if (!params) {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-zinc-100">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
      );
  }

  return (
      <main className="min-h-screen bg-zinc-100 pt-24 pb-10">
          <Header />
          <div className="w-full px-2 sm:px-4">
              <CompleteProfileForm 
                phone={params.phone}
                countryCode={params.countryCode}
                countryName={params.countryName}
                province={params.province}
                referralCode={params.referralCode}
                lang={params.lang}
              />
          </div>
          <Footer />
      </main>
  );
}

export default function CompleteProfilePage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-[#000E38] text-white">
                <Loader2 className="animate-spin h-10 w-10 text-[#FF6600]" />
            </div>
        }>
            <CompleteProfilePageContent />
        </Suspense>
    );
}
