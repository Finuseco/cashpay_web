
'use client';

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Share2,
  ThumbsUp,
  BadgeCheck,
  Rocket,
  MessageSquare
} from 'lucide-react';
import { useAlertDialog } from '@/hooks/use-alert-dialog';
import { formatKiloMega } from '@/lib/utils';
import { BoostDialog } from '@/components/monpays/boost-dialog';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { MonPaysActivity, MonPaysCompany } from '@/lib/types';
import { getActivities, getCompanies } from '@/lib/actions/monpays.actions';


// --- Metadata Generation (Server) ---
type Props = {
  params: { id: string }
}

// Client Component for interactivity ---
function ActivityDetailClient({ activity, company }: { activity: MonPaysActivity, company: MonPaysCompany }) {
  'use client';

  const { openAlert } = useAlertDialog();
  
  const handleShare = () => {
    if (activity.isMonetized) {
      openAlert({
        variant: 'success',
        title: 'Partage réussi !',
        description: `Merci ! ${activity.rewardPerShare} CDF ont été ajoutés à votre portefeuille.`,
      });
    } else {
        openAlert({
            variant: 'info',
            title: 'Partagé !',
            description: 'Le lien a été copié dans votre presse-papiers.'
        });
    }
  };

  return (
    <div className="bg-zinc-800 rounded-b-lg pb-4">
      <div className="p-4">
        <Link href={`/monpays/company/${company.id}`} className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
              <AvatarImage src={company.logoUrl} alt={company.name} />
              <AvatarFallback>{company.name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div>
              <div className="flex items-center gap-1">
                  <p className="font-bold text-white hover:underline">{company.name}</p>
                  {company.isVerified && <BadgeCheck className="h-5 w-5 text-red-500" />}
              </div>
              <p className="text-xs text-zinc-400">{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true, locale: fr })}</p>
          </div>
        </Link>
        <p className="my-4 text-zinc-300">{activity.description}</p>
      </div>
      
      <div className="relative aspect-video bg-zinc-700">
        <Image
          src={activity.imageUrl}
          alt={activity.title}
          layout="fill"
          objectFit="cover"
          data-ai-hint="advertisement product"
        />
      </div>

      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center text-zinc-400">
            <div className="flex items-center gap-1 text-sm">
                <ThumbsUp className="h-4 w-4" />
                <span>{formatKiloMega(activity.likes)}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
                <span>{formatKiloMega(activity.shares)} partages</span>
            </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 border-t border-b border-zinc-700 py-1">
            <Button variant="ghost" className="text-zinc-300 hover:bg-zinc-700">
                <ThumbsUp className="h-5 w-5 mr-2"/> J'aime
            </Button>
            <Button variant="ghost" className="text-zinc-300 hover:bg-zinc-700" onClick={handleShare}>
                <Share2 className="h-5 w-5 mr-2"/> Partager
            </Button>
            <BoostDialog activity={activity} company={company}>
                <Button variant="ghost" className="text-yellow-400 hover:bg-zinc-700 hover:text-yellow-300">
                    <Rocket className="h-5 w-5 mr-2"/> Booster
                </Button>
            </BoostDialog>
        </div>
        <div className="border-t border-zinc-700 pt-4">
             <h3 className="text-lg font-bold mb-2">Commentaires</h3>
             <div className="text-center py-6 text-zinc-500">
                 <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                 <p>Section des commentaires à venir.</p>
            </div>
        </div>
      </div>
    </div>
  );
}

// --- Server Component Page ---
export default async function ActivityPage({ params }: Props) {
    const activities = await getActivities();
    const activity = activities.find(a => a.id.toString() === params.id);

    if (!activity) {
        notFound();
    }

    const companies = await getCompanies();
    const company = companies.find(c => c.id.toString() === activity.companyId.toString());
    
    if (!company) {
        notFound();
    }

    return (
        <Suspense fallback={<div>Chargement de l'activité...</div>}>
            <ActivityDetailClient activity={activity} company={company} />
        </Suspense>
    )
}
