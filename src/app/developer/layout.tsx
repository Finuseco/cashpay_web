
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function DeveloperLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // A simple layout wrapper for the public developer page
    return <main className="p-4 md:p-8">{children}</main>;
}
