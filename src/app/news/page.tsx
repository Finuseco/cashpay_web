
import { Suspense } from 'react';
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { NewsClient } from '@/components/news/news-client';
import { syncNewsFromRssFeeds } from '@/lib/actions/news.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

function NewsLoading() {
    return (
        <div className="p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <Skeleton className="h-9 w-48 mb-4" />
                <Skeleton className="h-10 w-full mb-6" />
                <div className="space-y-6">
                    {[...Array(3)].map((_, i) => (
                       <Card key={i} className="overflow-hidden"><Skeleton className="h-40 w-full"/><div className="p-4 space-y-2"><Skeleton className="h-4 w-1/4"/><Skeleton className="h-6 w-full"/><Skeleton className="h-4 w-3/4"/></div></Card>
                    ))}
                </div>
            </div>
        </div>
    )
}

// This component now only handles data fetching and passes it to the client component.
async function NewsData() {
    // This action will now fetch from our database after syncing with RSS feeds
    // We can run sync here, but for a production app, this should be a cron job.
    await syncNewsFromRssFeeds();
    
    return <NewsClient />;
}


export default function NewsPage() {
    return (
        <DashboardLayout pageTitleKey="pageTitleNews">
            <main className="flex-1">
                <Suspense fallback={<NewsLoading />}>
                    <NewsData />
                </Suspense>
            </main>
        </DashboardLayout>
    );
}
