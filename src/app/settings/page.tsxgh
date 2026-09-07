

import { SettingsClient } from "@/components/settings/settings-client";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();

  return (
    <DashboardLayout pageTitleKey="pageTitleSettings">
      <main className="flex-1 p-4 md:p-8">
        <div className="container mx-auto">
          <SettingsClient user={user} />
        </div>
      </main>
    </DashboardLayout>
  );
}
