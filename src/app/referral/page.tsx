

import { ReferralClient } from "@/components/referral/referral-client";
import type { User, Referral, Currency } from "@/lib/types";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getReferralsForUser, getReferralConversionRate } from "@/lib/actions/referral.actions";
import { redirect } from 'next/navigation';
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import { countryToCode } from "@/lib/utils";

export default async function ReferralPage() {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    redirect('/login');
  }

  // Fetch referrals and user currencies in parallel
  const [referrals, currencies] = await Promise.all([
    getReferralsForUser(user.id),
    getUserCurrencies(user.id),
  ]);
  
  const userCountryCode = user.country ? countryToCode(user.country) : null;
  const localCurrency = currencies.find(c => c.code !== 'USD' && c.code !== 'EUR');
  const conversionRate = await getReferralConversionRate(userCountryCode);


  return (
    <DashboardLayout pageTitleKey="pageTitleReferral">
      <ReferralClient user={user} referrals={referrals} currencies={currencies} pointConversionRate={conversionRate} />
    </DashboardLayout>
  )
}
