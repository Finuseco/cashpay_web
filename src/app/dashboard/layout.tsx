
'use client';

import { Suspense, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Providers } from '@/components/providers';

function DashboardContentLayout({ children, pageTitleKey }: { children: React.ReactNode; pageTitleKey?: string }) {
    return <DashboardLayout pageTitleKey={pageTitleKey}>{children}</DashboardLayout>;
}

export default function Layout({
  children,
  ...props
}: {
  children: React.ReactNode;
  pageTitleKey?: string;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Skeleton className="h-full w-full"/></div>
  }
  
  return (
    <Suspense>
      <Providers>
        <DashboardLayout {...props}>
          {children}
        </DashboardLayout>
      </Providers>
    </Suspense>
  );
}
