'use client';

import { JojoFooter } from '@/components/shopping/jojo-footer';
import { JojoHeader } from '@/components/shopping/jojo-header';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

export default function ShoppingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const noHeaderPaths = [
    '/shopping/account',
    '/shopping/orders',
    '/shopping/address',
    '/shopping/wishlist',
    '/shopping/followed-stores',
    '/shopping/vouchers',
  ];

  const showHeader = !noHeaderPaths.some((path) =>
    pathname.startsWith(path)
  );

  return (
    <Suspense>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        {showHeader && <JojoHeader />}

        <main className="flex-1 overflow-y-auto pb-20">
          {children}
        </main>

        <JojoFooter />
      </div>
    </Suspense>
  );
}
