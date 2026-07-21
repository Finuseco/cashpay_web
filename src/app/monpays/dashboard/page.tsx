
'use client';

import { Suspense, useMemo, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ActivityCard } from '@/components/monpays/activity-card';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Plus, BadgeCheck, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import Image from 'next/image';
import type { MonPaysCompany, MonPaysActivity, User, StatusGroup } from '@/lib/types';
import { getCompanies, getActivities, getCompaniesForUser } from '@/lib/actions/monpays.actions';
import { getStatusesForUser } from '@/lib/actions/status.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

const StoryCard = ({ statusGroup }: { statusGroup: StatusGroup }) => {
    const latestStatus = statusGroup.statuses[statusGroup.statuses.length - 1];

    let backgroundStyle: React.CSSProperties = {
        backgroundColor: '#333'
    };
    if (latestStatus.type === 'image' || latestStatus.type === 'video') {
        backgroundStyle.backgroundImage = `url(${latestStatus.content})`;
        backgroundStyle.backgroundSize = 'cover';
        backgroundStyle.backgroundPosition = 'center';
    } else if (latestStatus.backgroundColor) {
        backgroundStyle.backgroundColor = latestStatus.backgroundColor;
    }

    return (
        <div style={backgroundStyle} className="relative w-28 h-48 rounded-lg overflow-hidden shrink-0 group cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <Avatar className="absolute top-2 left-2 h-8 w-8 border-2 border-blue-500">
                <AvatarImage src={statusGroup.contact.profile_photo || ''} />
                <AvatarFallback>{statusGroup.contact.full_name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <p className="absolute bottom-2 left-2 right-2 text-white text-xs font-semibold truncate">{statusGroup.contact.full_name}</p>
        </div>
    );
};

const CreateStoryCard = ({ user }: { user: User | null }) => (
    <Link href="/status/create">
        <div className="relative w-28 h-48 rounded-lg overflow-hidden shrink-0 group bg-zinc-700 cursor-pointer">
            <div className="h-2/3 w-full relative">
                {user?.profile_photo && <Image src={user.profile_photo} alt="User profile" layout="fill" objectFit="cover" />}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-zinc-800 flex items-end justify-center pb-2">
                <p className="text-white text-[10px] font-semibold">Ajouter un statut</p>
            </div>
            <div className="absolute top-2/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center border-4 border-zinc-800">
                <Plus className="text-white h-5 w-5"/>
            </div>
        </div>
    </Link>
);


function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get('q') || '';

  const [activities, setActivities] = useState<MonPaysActivity[]>([]);
  const [companies, setCompanies] = useState<MonPaysCompany[]>([]);
  const [myVerifiedCompanies, setMyVerifiedCompanies] = useState<MonPaysCompany[]>([]);
  const [statusGroups, setStatusGroups] = useState<StatusGroup[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        setIsLoadingData(true);
        const [fetchedActivities, fetchedCompanies, fetchedUser] = await Promise.all([
            getActivities(),
            getCompanies(),
            getAuthenticatedUser()
        ]);
        
        setActivities(fetchedActivities);
        setCompanies(fetchedCompanies);
        setUser(fetchedUser);

        if (fetchedUser) {
            const [myCompanies, fetchedStatuses] = await Promise.all([
                getCompaniesForUser(fetchedUser.id),
                getStatusesForUser(fetchedUser.id)
            ]);
            setMyVerifiedCompanies(myCompanies.filter(c => c.isVerified));
            setStatusGroups(fetchedStatuses);
        }
        setIsLoadingData(false);
    };
    fetchData();
  }, []);


  const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies]);

  const filteredActivities = useMemo(() => {
    if (!searchTerm) return activities;
    const lowercasedTerm = searchTerm.toLowerCase();
    return activities.filter(activity => 
        activity.description.toLowerCase().includes(lowercasedTerm) ||
        companyMap.get(activity.companyId)?.name.toLowerCase().includes(lowercasedTerm)
    );
  }, [activities, searchTerm, companyMap]);

  return (
    <div className="bg-zinc-900 min-h-screen">
      {/* Premium Publish Bar */}
      <div className="p-3 border-b border-zinc-700 bg-zinc-800">
        {myVerifiedCompanies.length > 0 ? (
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={myVerifiedCompanies[0].logoUrl} />
                    <AvatarFallback>{myVerifiedCompanies[0].name[0]}</AvatarFallback>
                </Avatar>
                <button 
                    onClick={() => router.push(`/monpays/company/${myVerifiedCompanies[0].id}/publish`)}
                    className="flex-1 text-left bg-zinc-700 hover:bg-zinc-600 transition-colors py-2 px-4 rounded-full text-zinc-300 text-sm"
                >
                    Publier en tant que {myVerifiedCompanies[0].name}...
                </button>
                <Button variant="ghost" size="icon" onClick={() => router.push(`/monpays/company/${myVerifiedCompanies[0].id}/publish`)}>
                    <ImageIcon className="text-green-500" />
                </Button>
            </div>
        ) : (
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="h-10 w-10 bg-red-600/10 rounded-full flex items-center justify-center">
                        <Megaphone className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-white">Devenez un Partenaire Certifié</p>
                        <p className="text-[10px] text-zinc-400">Publiez vos annonces et gagnez en visibilité.</p>
                    </div>
                </div>
                <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 h-8 text-xs font-bold">
                    <Link href="/monpays/create-company">Certifier ma page</Link>
                </Button>
            </div>
        )}
      </div>

      {/* Stories Section */}
       <div className="border-b border-zinc-700 bg-zinc-800">
          <ScrollArea>
                <div className="flex space-x-2 p-3">
                    <CreateStoryCard user={user} />
                    {statusGroups.map(group => (
                        <StoryCard key={group.contact.id} statusGroup={group} />
                    ))}
                </div>
                <ScrollBar orientation="horizontal" className="invisible"/>
            </ScrollArea>
       </div>


       {/* Feed */}
       <div className="max-w-2xl mx-auto space-y-3 py-3">
            {isLoadingData ? (
                [...Array(3)].map((_, i) => (
                    <div key={i} className="bg-zinc-800 rounded-lg p-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-zinc-700 rounded-full animate-pulse" />
                            <div className="h-4 w-32 bg-zinc-700 rounded animate-pulse" />
                        </div>
                        <div className="h-48 w-full bg-zinc-700 rounded animate-pulse" />
                    </div>
                ))
            ) : filteredActivities.map(activity => {
                const company = companyMap.get(activity.companyId);
                if (!company) return null;
                return <ActivityCard key={activity.id} activity={activity} company={company} />;
            })}
            
            {!isLoadingData && filteredActivities.length === 0 && (
                <div className="text-center py-20 text-zinc-500">
                    <p>Aucune publication premium pour le moment.</p>
                </div>
            )}
        </div>
    </div>
  );
}

export default function MonPaysDashboardPage() {
    return (
        <Suspense fallback={<div className="bg-zinc-900 text-white text-center p-8">Chargement...</div>}>
            <DashboardClient />
        </Suspense>
    )
}
