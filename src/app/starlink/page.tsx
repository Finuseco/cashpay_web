

import { StarlinkPaymentClient } from "./starlink-payment-client";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default async function StarlinkPaymentPage() {
  const user = await getAuthenticatedUser();
  return (
    <DashboardLayout>
        <StarlinkPaymentClient user={user} />
    </DashboardLayout>
  )
}
