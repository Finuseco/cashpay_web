
import { Suspense } from "react";
import { PageHeader } from "@/components/cards/page-header";
import type { Card, User, Currency } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getCardsForUser, getCardRequestsForUser } from "@/lib/actions/card.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { redirect } from "next/navigation";

function CardsLoading() {
    return (
      <main className="flex-1 p-4 md:p-8 space-y-8">
          <div className="container mx-auto">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="mt-8 grid gap-8 md:grid-cols-1 lg:grid-cols-2">
                <div className="space-y-4">
                    <Skeleton className="aspect-[1.586] w-full max-w-sm mx-auto rounded-2xl" />
                    <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-40 w-full rounded-lg" />
                </div>
            </div>
          </div>
        </main>
    )
}

async function CardsContent({ user }: { user: User }) {
  const [cards, currencies, cardRequests] = await Promise.all([
    getCardsForUser(user.id, user.full_name),
    getUserCurrencies(user.id),
    getCardRequestsForUser(user.id),
  ]);

  return (
    <>
      <main className="flex-1 p-4 md:p-8 space-y-8 bg-muted/30">
        <div className="container mx-auto">
            <PageHeader user={user} cards={cards} cardRequests={cardRequests} currencies={currencies} />
        </div>
      </main>
    </>
  )
}

export default async function CardsPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }
  
  return (
    <DashboardLayout pageTitleKey="pageTitleCards">
        <Suspense fallback={<CardsLoading />}>
          <CardsContent user={user} />
        </Suspense>
    </DashboardLayout>
  );
}

    
