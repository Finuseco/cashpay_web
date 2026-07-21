
import { ReportsClient } from '@/components/agent/reports-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Suspense } from 'react';

function ReportsLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-9 w-48 mb-2" />
                <Skeleton className="h-5 w-72" />
            </div>
            
            <div className="flex justify-end">
                <Skeleton className="h-10 w-64" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
                <Skeleton className="h-28 rounded-lg" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle><Skeleton className="h-6 w-1/2" /></CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <Skeleton className="h-[350px] w-full" />
                    </CardContent>
                </Card>
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle><Skeleton className="h-6 w-1/2" /></CardTitle>
                        <Skeleton className="h-4 w-3/4" />
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div></div>
                        <div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div></div>
                        <div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div></div>
                        <div className="flex items-center gap-4"><Skeleton className="h-10 w-10 rounded-md" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-1/2" /></div></div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}


export default function AgentReportsPage() {
    return (
        <Suspense fallback={<ReportsLoading />}>
            <ReportsClient />
        </Suspense>
    );
}
