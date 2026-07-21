

import { Suspense } from 'react';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getUserTransactions } from '@/lib/actions/transaction.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { getCardsForUser } from '@/lib/actions/card.actions';
import { getLoanForUser } from '@/lib/actions/loan.actions';
import { redirect } from 'next/navigation';

// A loading component that mimics the dashboard layout
function DashboardLoading() {
    return (
       <main className="flex-1 p-4 md:p-8">
          <div className="container mx-auto space-y-8">
              {/* Transactions List Skeleton */}
              <section>
                   <div className="flex items-center justify-between mb-4">
                     <Skeleton className="h-8 w-1/3 rounded-md" />
                     <Skeleton className="h-6 w-24 rounded-md" />
                   </div>
                   <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4 p-4 bg-card rounded-xl">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                          <Skeleton className="h-5 w-20" />
                        </div>
                      ))}
                    </div>
              </section>
          </div>
        </main>
    );
}

// The actual page content that now fetches real data
async function DashboardContent() {
    const user = await getAuthenticatedUser();

    if (!user) {
        redirect('/login');
    }

    const [transactions, currencies, cards, loan] = await Promise.all([
        getUserTransactions(user.id),
        getUserCurrencies(user.id),
        getCardsForUser(user.id, user.full_name),
        getLoanForUser(user.id)
    ]);
    
    return (
        <DashboardClient user={user} currencies={currencies} transactions={transactions} cards={cards} loan={loan} />
    );
}

// The main page is now an async Server Component
export default async function DashboardPage() {
    return (
        <Suspense fallback={<DashboardLoading />}>
          <DashboardContent />
        </Suspense>
    );
}

    