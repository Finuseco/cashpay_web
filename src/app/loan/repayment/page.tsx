import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getLoanHistory } from '@/lib/actions/loan.actions';
import LoanRepaymentClient from './loan-repayment-client';

export default async function LoanRepaymentPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return <main className="min-h-full bg-[#000E38] px-4 py-10 text-white"><div className="mx-auto max-w-3xl rounded-xl bg-[#071A4A] p-8 text-center"><h1 className="text-2xl font-bold">Remboursement LoanMe</h1><p className="mt-2 text-zinc-300">Vous devez être connecté pour rembourser un crédit.</p></div></main>;
  }
  const history = await getLoanHistory(Number(user.id));
  return <LoanRepaymentClient loans={Array.isArray(history) ? history : []} userId={Number(user.id)} />;
}
