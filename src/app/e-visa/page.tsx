
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { EvisaForm } from "./evisa-form";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { redirect } from 'next/navigation';
import { getEviaCountries } from "@/lib/actions/evisa.actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { History } from "lucide-react";

export default async function EvisaPage() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login?returnTo=/e-visa');
    }
    const countries = await getEviaCountries();

    return (
        <DashboardLayout pageTitleKey="pageTitleEvisa">
            <main className="flex-1 p-4 md:p-8">
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex justify-end">
                        <Button asChild variant="outline">
                            <Link href="/e-visa/history">
                                <History className="mr-2 h-4 w-4" />
                                Mes Demandes
                            </Link>
                        </Button>
                    </div>
                    <EvisaForm user={user} countries={countries} />
                </div>
            </main>
        </DashboardLayout>
    );
}
