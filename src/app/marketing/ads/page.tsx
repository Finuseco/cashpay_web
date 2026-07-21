

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { AdsClient } from "@/components/marketing/ads-client";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getAdCampaignsForUser } from "@/lib/actions/ads.actions";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { PublisherClient } from "@/components/marketing/publisher-client";

async function AdsContent() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login');
    }
    const campaigns = await getAdCampaignsForUser(user.id);
    return <AdsClient user={user} initialCampaigns={campaigns} />;
}

function AdsLoading() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    )
}

function PublisherLoading() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    )
}

export default function AdsAndPublisherPage() {
    
    return (
        <DashboardLayout pageTitleKey="pageTitleAds">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <Tabs defaultValue="advertiser" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="advertiser">Annonceur</TabsTrigger>
                            <TabsTrigger value="publisher">Éditeur (Blogueur)</TabsTrigger>
                        </TabsList>
                        <TabsContent value="advertiser" className="mt-6">
                            <Suspense fallback={<AdsLoading />}>
                                <AdsContent />
                            </Suspense>
                        </TabsContent>
                        <TabsContent value="publisher" className="mt-6">
                             <Suspense fallback={<PublisherLoading />}>
                                <PublisherClient />
                            </Suspense>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </DashboardLayout>
    );
}
