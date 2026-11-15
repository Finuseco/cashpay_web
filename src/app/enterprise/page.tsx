import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { EnterpriseConsole } from "@/components/enterprise/enterprise-console";
export default function Page() {
  return (
    <DashboardLayout>
      <EnterpriseConsole />
    </DashboardLayout>
  );
}
