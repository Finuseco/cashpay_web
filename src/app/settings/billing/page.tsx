

import { BillingAgreements } from "@/components/settings/billing-agreements";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

// Note: This page is not directly used in the new Tabs layout,
// but it's good practice to have a route for it.
// The actual content is rendered within settings/page.tsx via the SettingsClient component.
export default async function BillingSettingsPage() {
    const user = await getAuthenticatedUser();
    return (
        <DashboardLayout>
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <BillingAgreements user={user} />
                </div>
            </main>
        </DashboardLayout>
    );
}
