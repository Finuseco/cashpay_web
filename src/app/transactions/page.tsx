
import { Suspense } from 'react';
import { TransactionsClient } from "@/components/transactions/transactions-client";
import { Skeleton } from '@/components/ui/skeleton';
import type { Transaction, User } from '@/lib/types';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserTransactions } from '@/lib/actions/transaction.actions';
import { redirect } from 'next/navigation';

// Ce composant ne doit pas utiliser de hooks client comme useTranslation
function TransactionsLoading() {
  return (
    <div className="space-y-4">
       <div className="flex space-x-2 mb-4">
        <Skeleton className="h-10 w-20 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// Ce composant est maintenant un pur composant serveur qui récupère les données
async function TransactionsContent() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login');
    }
    const transactions: Transaction[] = await getUserTransactions(user.id, 100); // Charger plus de transactions

    // Les données sont passées au composant client qui gérera l'affichage et la traduction
    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="container mx-auto">
                <TransactionsClient initialTransactions={transactions} />
            </div>
        </main>
    );
}

// La page principale reste un composant serveur
export default async function TransactionsPage() {
  return (
    <DashboardLayout>
        <Suspense fallback={
            <main className="flex-1 p-4 md:p-8">
                <div className="container mx-auto">
                    {/* Le titre est statique ou géré dans le layout */}
                    <h1 className="text-2xl font-bold text-foreground mb-4">Mes Transactions</h1>
                    <TransactionsLoading />
                </div>
            </main>
        }>
            <TransactionsContent />
        </Suspense>
    </DashboardLayout>
  );
}
