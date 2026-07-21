'use client';

import { Suspense } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { BinaryTreeView } from '@/components/mlm/binary-tree-view';
import { getMlmNetworkTree } from '@/lib/actions/mlm.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';

function TreePageLoading() {
    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <Skeleton className="h-9 w-1/3 mb-2" />
                <Skeleton className="h-5 w-2/3 mb-8" />
                <Skeleton className="h-[600px] w-full" />
            </div>
        </main>
    )
}

function TreePageContent() {
    const [networkData, setNetworkData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const user = await getAuthenticatedUser();
            if(user) {
                const data = await getMlmNetworkTree(user.id);
                setNetworkData(data);
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);
    
    if (isLoading) {
        return <TreePageLoading />;
    }
    
    if (!networkData) {
        return <div className="text-center p-8 text-muted-foreground">Aucune donnée de réseau trouvée.</div>;
    }

    return (
        <main className="flex-1 p-4 md:p-8 overflow-x-auto">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-foreground">Généalogie du Réseau</h1>
                <p className="text-muted-foreground mb-8">Visualisez la structure complète de votre arbre binaire.</p>
                <div className="min-w-[800px]">
                    <BinaryTreeView networkData={networkData} />
                </div>
            </div>
        </main>
    );
}


export default function NetworkTreePage() {
    return (
        <DashboardLayout pageTitleKey="pageTitleNetworkMarketing">
            <Suspense fallback={<TreePageLoading />}>
                <TreePageContent />
            </Suspense>
        </DashboardLayout>
    );
}
