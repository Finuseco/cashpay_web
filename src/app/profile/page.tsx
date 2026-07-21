
'use client';

import { Suspense } from 'react';
import { ProfileClient } from "@/components/profile/profile-client";
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';

// A loading component to show while data is being fetched
function ProfileLoading() {
  return (
    <main className='flex-1'>
      <div className="w-full">
        <Skeleton className="h-48 md:h-56 w-full" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="-mt-16 sm:-mt-20 flex justify-center">
            <Skeleton className="h-28 w-28 sm:h-32 sm:w-32 rounded-full ring-4 ring-background" />
          </div>
        </div>
        <div className="mt-20 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </main>
  )
}

function ProfilePageContent() {
  return (
    <main className="flex-1">
      <ProfileClient />
    </main>
  );
}

export default function ProfilePage() {
  return (
    <DashboardLayout pageTitleKey='pageTitleProfile'>
      <Suspense fallback={<ProfileLoading />}>
        <ProfilePageContent />
      </Suspense>
    </DashboardLayout>
  );
}
