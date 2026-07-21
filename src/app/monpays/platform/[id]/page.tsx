
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getActivities, getCompanies } from '@/lib/actions/monpays.actions';
import { PlatformDetailClient } from '@/components/monpays/platform-detail-client';

type Props = {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const activities = await getActivities();
  const activity = activities.find(a => a.id.toString() === params.id);

  if (!activity) {
    return {
      title: 'Activité non trouvée',
      description: "L'activité demandée n'a pas pu être trouvée.",
    }
  }
  const companies = await getCompanies();
  const company = companies.find(c => c.id.toString() === activity.companyId.toString());

  const title = `${activity.title || 'Activité'} par ${company?.name || 'MonPays'}`;
  const description = activity.description;
  const imageUrl = activity.imageUrl;

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: [
        {
          url: imageUrl,
          width: 600,
          height: 315,
          alt: activity.title,
        },
      ],
      type: 'article',
      siteName: 'CashPay - MonPays',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [imageUrl],
    },
  }
}

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
        <Suspense fallback={<div className="flex justify-center p-10 text-white"><span className="animate-pulse">Chargement de l'activité...</span></div>}>
            <PlatformDetailClient activity={activity} company={company} />
        </Suspense>
    )
}
