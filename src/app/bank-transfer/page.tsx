

import { BankTransferClient } from "@/components/bank-transfer/bank-transfer-client";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { getCountriesList } from "@/lib/actions/countries.actions";
import { redirect } from 'next/navigation';

export default async function BankTransferPage() {
    const user = await getAuthenticatedUser();
    if (!user) {
        redirect('/login');
    }
    const [currencies, countries] = await Promise.all([
        getUserCurrencies(user.id),
        getCountriesList()
    ]);

    return (
        <DashboardLayout pageTitleKey="pageTitleBankTransfer">
            <BankTransferClient user={user} currencies={currencies} countries={countries} />
        </DashboardLayout>
    );
}
