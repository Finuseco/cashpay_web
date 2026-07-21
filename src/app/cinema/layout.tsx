
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { NetOnHeader } from "@/components/cinema/neton-header";
import { Skeleton } from '@/components/ui/skeleton';
import { CinemaFooter } from '@/components/cinema/cinema-footer';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { db } from '@/lib/db'; // We need a way to check subscription

// This function is defined here because layouts must be Server Components or client components,
// and we need client-side logic (router). A server action would be better.
async function checkSubscription(userId: number): Promise<boolean> {
    // This is a placeholder. It would query the cinema_subscriptions table.
    // Since we can't do that directly on the client, we'll simulate it.
    console.log(`Checking subscription for user ${userId}...`);
    return true; // Assume subscribed for now
}

function CinemaLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isVerified, setIsVerified] = useState(false);
  
  const noLayoutPaths = ['/cinema/terms', '/cinema/splash'];
  const showLayout = !noLayoutPaths.includes(pathname) && !pathname.startsWith('/cinema/jojo');

  useEffect(() => {
    // This effect now handles subscription verification
    const verifyAndFetch = async () => {
        if (pathname === '/cinema/terms' || pathname === '/cinema/splash') {
            setIsVerified(true);
            return;
        }

        const user = await getAuthenticatedUser();
        if (!user) {
            router.replace('/login');
            return;
        }
        
        const hasSubscription = await checkSubscription(user.id);

        if (!hasSubscription) {
             router.replace('/cinema/package');
        } else {
            setIsVerified(true);
        }
    };
    verifyAndFetch();
  }, [pathname, router]);

  if (!isVerified) {
    return (
      <div className="flex flex-col h-screen bg-black">
        <div className="flex-1 flex items-center justify-center">
           <Skeleton className="h-32 w-32 rounded-full bg-zinc-800" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-black text-zinc-100">
      {showLayout && <NetOnHeader />}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>
      {showLayout && <CinemaFooter />}
    </div>
  );
}


export default function CinemaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    return (
        <Suspense>
            <CinemaLayoutContent>{children}</CinemaLayoutContent>
        </Suspense>
    );
}
