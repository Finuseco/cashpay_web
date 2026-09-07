'use client';

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import type { User } from '@/lib/types';
import { PinLockForm } from "@/components/auth/pin-lock-form";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

function AuthCheckLoading() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-8 bg-zinc-900">
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-br from-[#000e38] to-[#223a7a] rounded-b-[3rem] md:rounded-b-[4rem]" />
      <div className="flex flex-col items-center gap-4 text-white z-10 my-auto">
          <Loader2 className="h-8 w-8 animate-spin" />
      </div>
       <footer className="w-full max-w-md z-10 mt-auto py-4">
          <Separator className="my-4 bg-white/20" />
          <p className="text-center text-xs text-white/70">Chargement...</p>
      </footer>
    </main>
  );
}

function AuthCheckPageContent() {
  const router = useRouter();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const fetchUser = async () => {
        const fetchedUser = await getAuthenticatedUser();
        if (fetchedUser) {
            setUser(fetchedUser);
        } else {
            router.replace('/login');
        }
        setIsLoading(false);
    };
    fetchUser();
  }, [router]);

  if (isLoading || !user) {
    return <AuthCheckLoading />;
  }
  
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-8 bg-zinc-900">
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-br from-[#000e38] to-[#223a7a] rounded-b-[3rem] md:rounded-b-[4rem]" />
      
      <div className="w-full max-w-md z-10 my-auto">
        <PinLockForm user={user} />
      </div>

       <footer className="w-full max-w-md z-10 mt-auto py-4">
          <Separator className="my-4 bg-white/20" />
          <div className="text-center text-xs text-white/70 w-full">
            {isClient ? (
                <>
                    <p>{t('copyrightText', { year: new Date().getFullYear() })} {t('copyrightAllRightsReserved')}</p>
                    <div className="mt-2 flex gap-4 justify-center items-center">
                        <Link href="#" className="hover:text-white">{t('loginTermsAndConditions', 'Terms & Conditions')}</Link>
                        <Separator orientation="vertical" className="h-4 bg-white/50" />
                        <a href="https://developer.cashpay-all.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">{t('loginDevelopers', 'Developers')}</a>
                        <Separator orientation="vertical" className="h-4 bg-white/50" />
                        <LanguageSwitcher />
                    </div>
                </>
            ) : <p>&nbsp;</p>}
          </div>
      </footer>
    </main>
  );
}

export default function AuthCheckPage() {
    return (
        <Suspense fallback={<AuthCheckLoading/>}>
            <AuthCheckPageContent/>
        </Suspense>
    )
}
