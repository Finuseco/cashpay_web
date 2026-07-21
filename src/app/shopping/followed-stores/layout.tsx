// src/app/shopping/followed-stores/layout.tsx
'use client';

import { JojoHeader } from '@/components/shopping/jojo-header';

export default function FollowedStoresLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <JojoHeader showBackButton={true} title="Magasins suivis" />
            <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
    );
}
