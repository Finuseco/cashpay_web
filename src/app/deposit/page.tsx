
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { DepositClient } from "@/components/deposit/deposit-client";
import { Card, CardContent } from "@/components/ui/card";

export default async function DepositPage() {
  const user = await getAuthenticatedUser();

  return (
    <DashboardLayout pageTitleKey="pageTitleDeposit">
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {user && user.country ? (
            <DepositClient user={user} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <h3 className="font-semibold">Service de dépôt indisponible</h3>
                <p className="text-muted-foreground mt-2">
                  Veuillez compléter votre profil pour accéder à ce service.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
