
import { Suspense } from 'react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCompanyAnalytics } from '@/lib/actions/monpays.actions';
import { redirect } from 'next/navigation';
import { MonPaysAnalyticsClient } from '@/components/monpays/analytics-client';
import { Loader2 } from 'lucide-react';

export default async function MonPaysAnalyticsPage() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login?returnTo=/monpays/analytics');
    }

    const analyticsData = await getCompanyAnalytics(user.id);

    if (!analyticsData) {
        return (
            <div className="p-8 text-center text-zinc-400">
                <p>Vous ne possédez pas de page entreprise certifiée.</p>
                <p className="text-sm mt-2">Créez une page pour accéder aux analytiques.</p>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 min-h-screen text-white pb-20">
            <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin h-8 w-8" /></div>}>
                <MonPaysAnalyticsClient data={analyticsData} user={user} />
            </Suspense>
        </div>
    );
}
