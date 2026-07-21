
'use client';

import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import { Map, ShoppingCart, MessageCircle, Ticket, Briefcase } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import Image from 'next/image';

const ConnectivityLink = ({ href, icon: Icon, imgSrc, label }: { href: string; icon?: React.FC<LucideProps>; imgSrc?: string; label: string }) => (
    <Link href={href} className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors text-center">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary border border-white/20">
            {Icon && <Icon className="h-5 w-5" />}
            {imgSrc && <Image src={imgSrc} alt={label} width={24} height={24} />}
        </div>
        <span className="text-xs font-medium">{label}</span>
    </Link>
);


export default function LoginPage() {
  const { t } = useTranslation();
  
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-8 bg-zinc-900">
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-br from-[#ff6600] to-orange-500 rounded-b-[3rem] md:rounded-b-[4rem]" />
      
      <div className="w-full max-w-md z-10 my-auto">
        <LoginForm />
      </div>

       {/* Combined Connectivity and Footer section */}
      <footer className="w-full max-w-md z-10 mt-auto py-4">
            <div className="text-center mb-2">
                <h2 className="font-semibold text-white/90 text-sm">Découvrez notre centre de connectivité</h2>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-4">
                <ConnectivityLink href="/login?returnTo=%2Fmonpays" imgSrc="/logos/monpays1.png" label="MonPays" />
                <ConnectivityLink href="/login?returnTo=%2Fshopping" imgSrc="/logos/jojo1.png" label="Shopping" />
                <ConnectivityLink href="/login?returnTo=%2Ffeedback" imgSrc="/logos/onchat.png" label="OnChat" />
                <ConnectivityLink href="/login?returnTo=%2Fevents" icon={Ticket} label="Événements" />
                <ConnectivityLink href="/agent/login" icon={Briefcase} label="Espace Agent" />
            </div>

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
