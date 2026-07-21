

import { FeeScheduleClient } from "@/components/fees/fee-schedule-client";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default async function FeesPage() {
  return (
    <DashboardLayout pageTitleKey="pageTitleFees">
      <main className="flex-1 p-4 md:p-8">
        <FeeScheduleClient />
      </main>
    </DashboardLayout>
  );
}
