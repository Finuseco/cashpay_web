import { LottoClient } from "@/components/casino/lotto/lotto-client";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { getUserCurrencies } from "@/lib/actions/currency.actions";
import type { User, Currency, LottoBet, LottoResult } from "@/lib/types";

export default async function LottoPage() {
  const user: User | null = await getAuthenticatedUser();
  const currencies: Currency[] = user ? await getUserCurrencies(user.id) : [];
  
  // In a real app, bets and results would be fetched from a database
  const lottoBets: LottoBet[] = [];
  const lottoResults: LottoResult[] = [];
  
  const cdfBalance = currencies.find(c => c.code === 'CDF')?.balance || '0';

  return <LottoClient user={user} initialBalance={parseFloat(cdfBalance.replace(/,/g, ''))} bets={lottoBets} results={lottoResults} />;
}
