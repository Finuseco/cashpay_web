

'use client';

import { StarlinkPaymentClient } from "../starlink-payment-client";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Suspense, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/lib/types";

function StarlinkPaymentLoading() {
    return (
         <div className="flex-1 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                    <Skeleton className="h-9 w-64 mx-auto" />
                    <Skeleton className="h-5 w-80 mx-auto mt-2" />
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    )
}

export default function StarlinkPaymentPage() {
    const [user, setUser] = useState<User | null>(null);
    
    useEffect(() => {
        getAuthenticatedUser().then(setUser);
    }, []);

    return (
        <DashboardLayout>
            <Suspense fallback={<StarlinkPaymentLoading />}>
                <StarlinkPaymentClient user={user} />
            </Suspense>
        </DashboardLayout>
    )
}
