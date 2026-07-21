
'use client';

import { findUserByWalletId } from '@/lib/actions/user.actions';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
    ArrowRight, 
    Send, 
    CreditCard, 
    Smartphone, 
    Globe, 
    Landmark, 
    Receipt, 
    Repeat, 
    Handshake,
    ShoppingCart,
    Gamepad2,
    Ticket,
    Clapperboard,
    Newspaper,
    ShieldCheck,
    Gift
} from 'lucide-react';
import Link from 'next/link';
import type { LucideProps } from 'lucide-react';
import { CopyrightFooter } from '@/components/copyright-footer';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ServiceItem = ({ icon: Icon, title, description }: { icon: React.FC<LucideProps>, title: string, description: string }) => (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 shrink-0">
            <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
            <h3 className="font-semibold text-white text-sm">{title}</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{description}</p>
        </div>
    </div>
);

export default function ReferralPage({ params }: { params: { code: string } }) {
  const { t } = useTranslation();
  const [referrer, setReferrer] = useState<Partial<User> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchReferrer = async () => {
        const user = await findUserByWalletId(params.code);
        if (!user) {
            router.replace('/register');
            return;
        }
        setReferrer(user);
        setIsLoading(false);
    };
    fetchReferrer();
  }, [params.code, router]);

  if (isLoading || !referrer) {
    return (
        <div className="flex flex-col min-h-screen bg-zinc-950 text-white p-8 items-center justify-center space-y-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-20 w-full max-w-md" />
        </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-white font-sans">
      <main className="flex-1 pb-20">
        {/* Header Hero */}
        <div className="relative p-6 md:p-12 flex flex-col items-center text-center bg-gradient-to-br from-[#000e38] via-[#000e38] to-primary/40 rounded-b-[3rem] shadow-2xl border-b border-white/10">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <LanguageSwitcher />
            </div>
            
            <div className="relative mt-8">
                <Avatar className="h-28 w-28 border-4 border-primary shadow-xl">
                    <AvatarImage src={referrer.profile_photo || ''} alt={referrer.full_name} />
                    <AvatarFallback className="text-4xl bg-zinc-800">{referrer.full_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1.5 border-4 border-[#000e38]">
                    <ShieldCheck className="h-5 w-5 text-white" />
                </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-black mt-6 tracking-tight">
                {t('referralHeader', { name: referrer.full_name })}
            </h1>
            <p className="mt-3 text-sm md:text-base text-zinc-300 max-w-xl leading-relaxed">
                {t('referralSubHeader', { name: referrer.full_name })}
            </p>
        </div>

        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-12">
            {/* Services Grid */}
            <section className="space-y-6">
                <div className="text-center space-y-1">
                    <h2 className="text-xl font-bold uppercase tracking-widest text-primary">{t('referralWelcomeTitle')}</h2>
                    <p className="text-xs text-zinc-500">Explorez un monde de services sans frontières</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ServiceItem 
                        icon={Send} 
                        title={t('referralServiceNationalInternational')} 
                        description={t('referralServiceNationalInternationalDesc')} 
                    />
                    <ServiceItem 
                        icon={CreditCard} 
                        title={t('referralServiceCards')} 
                        description={t('referralServiceCardsDesc')} 
                    />
                    <ServiceItem 
                        icon={Smartphone} 
                        title={t('referralServiceMobileMoney')} 
                        description={t('referralServiceMobileMoneyDesc', 'Envoyez et retirez de l\'argent via tous les opérateurs mobiles locaux.')} 
                    />
                    <ServiceItem 
                        icon={ShoppingCart} 
                        title={t('referralServiceShopping', 'JoJo Shopping')} 
                        description={t('referralServiceShoppingDesc', 'Accédez au plus grand marché numérique avec des prix défiant toute concurrence.')} 
                    />
                    <ServiceItem 
                        icon={Gamepad2} 
                        title={t('referralServiceGaming', 'Gaming & Casino')} 
                        description={t('referralServiceGamingDesc', 'Défiez vos amis aux échecs ou tentez votre chance au lotto pour gagner gros.')} 
                    />
                    <ServiceItem 
                        icon={Ticket} 
                        title={t('referralServiceEvents', 'Événements & Billets')} 
                        description={t('referralServiceEventsDesc', 'Achetez vos billets de concerts, matchs et conférences instantanément.')} 
                    />
                    <ServiceItem 
                        icon={Handshake} 
                        title={t('referralServiceLoan')} 
                        description={t('referralServiceLoanDesc')} 
                    />
                    <ServiceItem 
                        icon={Repeat} 
                        title={t('referralServiceExchange')} 
                        description={t('referralServiceExchangeDesc')}
                    />
                    <ServiceItem 
                        icon={Clapperboard} 
                        title={t('referralServiceVideos', 'Vidéos & Stream')} 
                        description={t('referralServiceVideosDesc', 'Regardez des contenus exclusifs et gagnez de l\'argent en partageant des vidéos.')} 
                    />
                    <ServiceItem 
                        icon={Newspaper} 
                        title={t('referralServiceNews', 'Actualités en Direct')} 
                        description={t('referralServiceNewsDesc', 'Restez informé des dernières nouvelles nationales et internationales.')} 
                    />
                </div>
            </section>

            {/* Benefits Box */}
            <section className="p-8 bg-gradient-to-r from-primary/20 to-transparent rounded-3xl border border-primary/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Gift className="h-32 w-32 rotate-12" />
                </div>
                <h3 className="font-black text-2xl mb-4">{t('referralBenefitsTitle')}</h3>
                <ul className="space-y-4">
                    {[
                        t('referralBenefitWelcomeBonus'),
                        t('referralBenefitFirstTx'),
                        t('referralBenefitImmediateAccess')
                    ].map((benefit, i) => (
                        <li key={i} className="flex items-center gap-3 text-zinc-200">
                            <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                            <span className="font-medium">{benefit}</span>
                        </li>
                    ))}
                </ul>
            </section>
            
            {/* Final Call to Action */}
            <section className="text-center space-y-8 py-8">
                <div className="space-y-2">
                    <h3 className="text-2xl font-bold">{t('referralFinalInviteTitle')}</h3>
                    <p className="text-zinc-400">{t('referralFinalInviteBody', { name: referrer.full_name })}</p>
                </div>
                
                <div className="flex flex-col items-center gap-4">
                    <Button asChild size="lg" variant="gradient" className="w-full max-w-sm h-16 text-xl font-black shadow-[0_0_30px_rgba(255,102,0,0.3)] rounded-2xl group">
                        <Link href={`/register?ref=${params.code}`}>
                            {t('referralActionButton')} 
                            <ArrowRight className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-2" />
                        </Link>
                    </Button>
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Rejoignez 5M+ d'utilisateurs</p>
                </div>
            </section>
        </div>
      </main>
      <CopyrightFooter className="bg-zinc-950 border-t border-white/5"/>
    </div>
  );
}

function CheckCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
