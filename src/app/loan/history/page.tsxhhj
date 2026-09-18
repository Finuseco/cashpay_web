import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getLoanHistory } from '@/lib/actions/loan.actions';
import LoanHistoryClient from './loan-history-client';

export default async function LoanHistoryPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-[#000E38] px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-xl bg-[#071A4A] p-8 text-center">
          <h1 className="text-2xl font-bold">Historique LoanMe</h1>
          <p className="mt-2 text-zinc-300">
            Vous devez être connecté pour consulter votre historique.
          </p>
        </div>
      </main>
    );
  }

  let history: any[] = [];

  try {
    const result = await getLoanHistory(Number(user.id));
    history = Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('[Loan History] Load failed:', error);
  }

  return (
    <LoanHistoryClient
      initialHistory={history}
      userId={Number(user.id)}
    />
  );
}
