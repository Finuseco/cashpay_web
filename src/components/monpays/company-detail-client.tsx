'use client';

import * as React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Rss, Phone, MessageSquare, Users, Globe, MapPin, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ActivityCard } from '@/components/monpays/activity-card';
import type { MonPaysActivity, MonPaysCompany, User } from '@/lib/types';
import Link from 'next/link';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { recordPageVisit, getCompanyFollowerInfo, toggleFollowCompany } from '@/lib/actions/monpays.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { cn, formatKiloMega } from '@/lib/utils';

export function CompanyDetailClient({ company, companyActivities }: { company: MonPaysCompany, companyActivities: MonPaysActivity[] }) {
    const [isFollowing, setIsFollowing] = React.useState(false);
    const [followerCount, setFollowerCount] = React.useState(0);
    const [user, setUser] = React.useState<User | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const { openAlert } = useAlertDialog();

    React.useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            const fetchedUser = await getAuthenticatedUser();
            setUser(fetchedUser);
            
            const [followerInfo] = await Promise.all([
                getCompanyFollowerInfo(fetchedUser?.id, parseInt(company.id)),
                recordPageVisit(parseInt(company.id), fetchedUser?.id)
            ]);
            
            setIsFollowing(followerInfo.isFollowing);
            setFollowerCount(followerInfo.followerCount);
            setIsLoading(false);
        };
        init();
    }, [company.id]);

    const handleFollowToggle = async () => {
        if (!user) {
            openAlert({ title: "Connexion requise", description: "Veuillez vous connecter pour vous abonner à cette page.", variant: 'info' });
            return;
        }
        const result = await toggleFollowCompany(user.id, parseInt(company.id));
        if (result.success) {
            setIsFollowing(result.isFollowing!);
            setFollowerCount(prev => result.isFollowing ? prev + 1 : prev - 1);
        }
    };

    const handleCall = () => {
        openAlert({
            title: 'Appel Professionnel',
            description: `Contacter ${company.name} via CashPay Voice sera bientôt disponible.`,
            variant: 'info'
        });
    };

    return (
        <div className="bg-zinc-900 min-h-screen">
            <div className="relative h-48 bg-zinc-700">
                <Image
                src={company.bannerUrl}
                alt={`${company.name} banner`}
                fill
                className="object-cover"
                data-ai-hint="company banner"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            </div>

            <div className="p-4 -mt-16 relative z-10">
                <div className="flex items-end justify-between">
                    <Avatar className="h-24 w-24 rounded-lg border-4 border-zinc-900 bg-white flex-shrink-0">
                        <AvatarImage src={company.logoUrl} alt={company.name} />
                        <AvatarFallback>{company.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="pb-2">
                         <Button 
                            onClick={handleFollowToggle} 
                            variant={isFollowing ? 'secondary' : 'default'}
                            className={cn(
                                "font-bold shadow-lg",
                                !isFollowing ? "bg-red-600 hover:bg-red-700 text-white" : "bg-zinc-700 text-zinc-300"
                            )}
                        >
                          <Rss className="mr-2 h-4 w-4" />
                          {isFollowing ? "Abonné" : "S'abonner"}
                        </Button>
                    </div>
                </div>
                 <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold">{company.name}</h1>
                        {company.isVerified && <Image src="/images/badge/celebre.png" alt="Certifié" width={24} height={24} className="h-6 w-6"/>}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                        <p className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5"/> {company.category}</p>
                        <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5"/> <strong>{formatKiloMega(followerCount)}</strong> followers</p>
                    </div>

                     <p className="text-zinc-300 text-sm mt-3 leading-relaxed">
                        {company.description || `Bienvenue sur la page officielle de ${company.name}. Suivez-nous pour ne rien manquer de nos actualités.`}
                    </p>

                    <div className="flex gap-2 pt-4">
                        <Button asChild variant="outline" className="flex-1 bg-zinc-800 border-zinc-700 hover:bg-zinc-700">
                            <Link href={`/feedback?contactId=${company.ownerWalletId}`}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Chat
                            </Link>
                        </Button>
                         <Button variant="outline" className="flex-1 bg-zinc-800 border-zinc-700 hover:bg-zinc-700" onClick={handleCall}>
                            <Phone className="mr-2 h-4 w-4" />
                            Appel
                        </Button>
                    </div>
                </div>
            </div>
            
            <div className="p-4 space-y-4 border-t border-zinc-800 mt-4">
                <h2 className="text-lg font-bold">Publications</h2>
                
                {companyActivities.length > 0 ? (
                    <div className="space-y-4 pb-20">
                        {companyActivities.map(activity => (
                            <ActivityCard key={activity.id} activity={activity} company={company} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-zinc-500">
                        <p>Aucune publication pour le moment.</p>
                    </div>
                )}
            </div>
        </div>
      );
}
