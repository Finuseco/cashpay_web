import type { Metadata } from 'next';
import { MonPaysHeader } from '@/components/monpays/monpays-header';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'MonPays - CashPay',
  description: 'Certified digital platforms in your country.',
};

export default function MonPaysLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-900 text-white">
      <MonPaysHeader />
      <main className="flex-1">
        {children}
      </main>
       <div className="fixed bottom-6 right-6 z-30">
          <Button asChild className="h-16 w-16 rounded-full shadow-lg bg-red-600 hover:bg-red-700">
             <Link href="/monpays/create-company">
                <Plus className="h-8 w-8" />
                <span className="sr-only">Créer</span>
            </Link>
          </Button>
        </div>
    </div>
  );
}
