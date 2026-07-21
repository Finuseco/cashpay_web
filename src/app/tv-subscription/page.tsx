

import { TvSubscriptionPage } from "@/components/tv-subscription/tv-subscription-page-client";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export default async function Page() {
  const user = await getAuthenticatedUser();
  return (
    <DashboardLayout pageTitleKey="pageTitleTvSubscription">
        <TvSubscriptionPage user={user} />
    </DashboardLayout>
  )
}

    
