
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CompanyDetailClient } from '@/components/monpays/company-detail-client';
import { getCompanyById, getActivities } from '@/lib/actions/monpays.actions';

type Props = {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompanyById(params.id);
  
  if (!company) {
    return {
      title: 'Entreprise non trouvée',
      description: "L'entreprise demandée n'a pas pu être trouvée.",
    }
  }

  const title = `${company.name} - MonPays`;
  const description = company.description || `Suivez ${company.name} sur MonPays pour ne rien manquer de nos actualités et promotions exclusives.`;
  const imageUrl = company.bannerUrl;

  return {
    title: title,
    description: description.substring(0, 160),
    openGraph: {
      title: title,
      description: description.substring(0, 160),
      images: [
        {
          url: imageUrl || '',
          width: 1200,
          height: 630,
          alt: company.name,
        },
      ],
      type: 'profile',
      siteName: 'CashPay - MonPays',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description.substring(0, 160),
      images: [imageUrl || ''],
    },
  }
}

export default async function CompanyPage({ params }: Props) {
    const company = await getCompanyById(params.id);

    if (!company) {
        notFound();
    }
    
    const allActivities = await getActivities();
    const companyActivities = allActivities.filter(a => a.companyId === company.id);

    return (
        <Suspense fallback={<div className="p-8 text-center text-zinc-500">Chargement de l'entreprise...</div>}>
            <CompanyDetailClient company={company} companyActivities={companyActivities} />
        </Suspense>
    )
}
