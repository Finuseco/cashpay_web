

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function CloudMaxLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // This layout is minimal because child pages like /[domainName] will use their own layout
    return <>{children}</>;
}
