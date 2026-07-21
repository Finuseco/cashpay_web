

import { InvestmentClient } from "@/components/investment/investment-client";
import type { User, Currency } from "@/lib/types";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { redirect } from "next/navigation";

export default async function InvestmentPage() {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    redirect('/login');
  }

  const currencies: Currency[] = await getUserCurrencies(user.id);

  return (
    <DashboardLayout pageTitleKey="pageTitleInvestment">
      <InvestmentClient user={user} currencies={currencies} />
    </DashboardLayout>
  )
}
