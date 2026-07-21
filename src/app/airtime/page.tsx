
"use client";

import { useState, useEffect } from "react";
import { AirtimeForm } from "@/components/airtime/airtime-form";
import type { User } from "@/lib/types";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function AirtimeLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  )
}

export default function AirtimePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
        const fetchedUser = await getAuthenticatedUser();
        setUser(fetchedUser);
        setIsLoading(false);
    }
    fetchUser();
  }, []);

  return (
    <DashboardLayout pageTitleKey="pageTitleAirtime">
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
           {isLoading ? <AirtimeLoading /> : <AirtimeForm user={user} />}
        </div>
      </main>
    </DashboardLayout>
  );
}
