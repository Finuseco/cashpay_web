'use client';

import { JojoFooter } from '@/components/shopping/jojo-footer';
import { JojoHeader } from '@/components/shopping/jojo-header';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { PortalPinLock } from '@/components/auth/portal-pin-lock';
import { CopyrightFooter } from '@/components/copyright-footer';

export default function ShoppingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  
  const noHeaderPaths = [
    '/shopping/account',
    '/shopping/orders',
    '/shopping/address',
    '/shopping/wishlist',
    '/shopping/followed-stores',
    '/shopping/vouchers',
    '/shopping/categories',
  ];
  const showHeader = !noHeaderPaths.some(path => pathname.startsWith(path));

  return (
    <Suspense>
        <PortalPinLock portalName="Shopping">
             <div className="flex flex-col min-h-screen bg-background text-foreground">
                {showHeader && <JojoHeader />}
                <main className="flex-1 overflow-y-auto pb-20">{children}</main>
                <CopyrightFooter />
                <JojoFooter />
            </div>
        </PortalPinLock>
    </Suspense>
  );
}
