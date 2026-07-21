
import { LoanPageClient } from "@/components/loan/loan-page-client";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getLoanHistory } from "@/lib/actions/loan.actions";

export default async function LoanPage() {
    const user = await getAuthenticatedUser();
    const currencies = user ? await getUserCurrencies(user.id) : [];
    const loanHistory = user ? await getLoanHistory(user.id) : [];

    return (
        <DashboardLayout pageTitleKey="pageTitleLoan">
            <LoanPageClient user={user} currencies={currencies} loanHistory={loanHistory} />
        </DashboardLayout>
    );
}
