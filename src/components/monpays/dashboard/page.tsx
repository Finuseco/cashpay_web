
'use client';

import { Suspense, useMemo, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ActivityCard } from '@/components/monpays/activity-card';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Plus } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import Image from 'next/image';
import type { MonPaysStory, MonPaysCompany, MonPaysActivity, User, StatusGroup, Status } from '@/lib/types';
import { getCompanies, getActivities } from '@/lib/actions/monpays.actions';
import { getStatusesForUser } from '@/lib/actions/status.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

const StoryCard = ({ statusGroup }: { statusGroup: StatusGroup }) => {
    const latestStatus = statusGroup.statuses[statusGroup.statuses.length - 1];

    // Determine the background for the story card
    let backgroundStyle: React.CSSProperties = {
        backgroundColor: '#333' // Default background
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
                <p className="text-white text-xs font-semibold">Créer un statut</p>
            </div>
            <div className="absolute top-2/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center border-4 border-zinc-800">
                <Plus className="text-white h-6 w-6"/>
            </div>
        </div>
    </Link>
);


function DashboardClient() {
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get('q') || '';

  const [activities, setActivities] = useState<MonPaysActivity[]>([]);
  const [companies, setCompanies] = useState<MonPaysCompany[]>([]);
  const [statusGroups, setStatusGroups] = useState<StatusGroup[]>([]);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchData = async () => {
        const [fetchedActivities, fetchedCompanies, fetchedUser, fetchedStatuses] = await Promise.all([
            getActivities(),
            getCompanies(),
            getAuthenticatedUser(),
            getStatusesForUser(1) // Assuming user ID 1 for now, should be dynamic
        ]);
        setActivities(fetchedActivities);
        setCompanies(fetchedCompanies);
        setUser(fetchedUser);
        setStatusGroups(fetchedStatuses);
    };
    fetchData();
  }, []);


  const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c])), [companies]);

  const filteredActivities = useMemo(() => {
    if (!searchTerm) {
        return activities;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return activities.filter(activity => 
        activity.title.toLowerCase().includes(lowercasedTerm) ||
        activity.description.toLowerCase().includes(lowercasedTerm) ||
        companyMap.get(activity.companyId)?.name.toLowerCase().includes(lowercasedTerm)
    );
  }, [activities, searchTerm, companyMap]);

  return (
    <div className="bg-zinc-900 min-h-screen">
      {/* Create Post Section */}
      <div className="p-3 border-b border-zinc-700">
        <div className="flex items-center gap-3">
            <Link href="/profile">
              <Avatar>
                  <AvatarImage src={user?.profile_photo || ''} />
                  <AvatarFallback>{user?.first_name?.[0]}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 text-left text-zinc-400">À quoi pensez-vous ?</div>
            <Button variant="ghost" size="icon">
                <ImageIcon className="text-green-500" />
            </Button>
        </div>
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
       <div className="space-y-2 py-2">
            {filteredActivities.map(activity => {
                const company = companyMap.get(activity.companyId);
                if (!company) return null;
                return <ActivityCard key={activity.id} activity={activity} company={company} />;
            })}
             {filteredActivities.length === 0 && (
                <div className="text-center py-16 text-zinc-500">
                    <p>Aucune activité trouvée pour "{searchTerm}".</p>
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
