'use client';

import type { LoanHistory } from '@/lib/actions/loan.actions';
import { getLoanOffer, repayLoan } from '@/lib/actions/loan.actions';
import { verifyUserPin } from '@/lib/actions/auth.actions';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const symbols: Record<string, string> = { USD: '$', EUR: '€', CDF: 'FC' };
const money = (v: unknown) => Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : 0;
const date = (v: unknown) => {
  const d = new Date(String(v || ''));
  return Number.isNaN(d.getTime()) ? 'Date non disponible' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

export default function LoanRepaymentClient({ loans, userId }: { loans: LoanHistory[]; userId: number }) {
  const router = useRouter();
  const activeLoans = loans.filter((loan: any) => String(loan.status).toLowerCase() === 'approved' && n(loan.remaining_balance) > 0.005);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<{ loan: LoanHistory; amount: number } | null>(null);
  const [pin, setPin] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const openRepayment = (loan: LoanHistory, amount: number) => {
    const remaining = n((loan as any).remaining_balance);
    if (amount <= 0) return setError('Entrez un montant de remboursement valide.');
    if (amount > remaining + 0.005) return setError(`Le montant ne peut pas dépasser ${money(remaining)} ${(loan as any).currency}.`);
    setError(''); setPin(''); setSelected({ loan, amount });
  };

  const confirm = async () => {
    if (!selected || !/^\d{4,6}$/.test(pin)) return setError('Entrez votre code PIN.');
    setProcessing(true); setError('');
    try {
      const verified = await verifyUserPin(Number(userId), pin);
      if (!verified?.success) return setError(verified?.error || 'Code PIN incorrect.');
      const currency = String((selected.loan as any).currency || '').toUpperCase();
      const offer = await getLoanOffer(Number(userId), currency);
      if (n(offer?.balance) + 0.005 < selected.amount) return setError(`Solde insuffisant. Disponible : ${money(offer?.balance)} ${currency}.`);
      const result = await repayLoan(Number(userId), n((selected.loan as any).id), selected.amount);
      if (!result?.success) return setError(result?.error || 'Remboursement impossible.');
      setSelected(null); setPin(''); setAmounts({}); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Une erreur est survenue.'); }
    finally { setProcessing(false); }
  };

  return (
    <main className="min-h-full bg-[#000E38] p-4 text-white md:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-3xl font-bold">Remboursement LoanMe</h1><p className="mt-1 text-zinc-300">Payez une partie de votre dette ou soldez toute la dette, intérêts compris.</p></div>
          <div className="flex gap-2"><Link href="/loan" className="rounded-lg border border-white/10 px-4 py-2 text-sm">Demander un crédit</Link><Link href="/loan/history" className="rounded-lg border border-[#FF6600]/50 px-4 py-2 text-sm text-[#FF6600]">Historique</Link></div>
        </header>

        {activeLoans.length === 0 ? <section className="rounded-2xl border border-white/10 bg-[#071A4A] p-8 text-center"><h2 className="text-xl font-semibold">Aucune dette active</h2><p className="mt-2 text-zinc-300">Vous n’avez actuellement aucun crédit à rembourser.</p></section> : activeLoans.map((loan: any) => {
          const id = n(loan.id), currency = String(loan.currency || '').toUpperCase(), symbol = symbols[currency] || currency;
          const principal = n(loan.principal_amount ?? (n(loan.amount) / (1 + n(loan.interest_rate) / 100))), total = n(loan.total_repayment ?? loan.amount), remaining = n(loan.remaining_balance);
          const interest = Math.max(0, total - principal);
          const schedule = Array.isArray(loan.schedule) ? loan.schedule : [];
          const amount = n(amounts[id]);
          return <article key={id} className="rounded-2xl border border-white/10 bg-[#071A4A] p-5 shadow-xl">
            <div className="grid gap-3 sm:grid-cols-4">
              <div><p className="text-xs text-zinc-400">Montant prêté</p><p className="text-xl font-bold">{symbol}{money(principal)}</p></div>
              <div><p className="text-xs text-zinc-400">Intérêt ({n(loan.interest_rate).toFixed(2)}%)</p><p className="text-xl font-bold text-[#FF6600]">+{symbol}{money(interest)}</p></div>
              <div><p className="text-xs text-zinc-400">Dette totale</p><p className="text-xl font-bold">{symbol}{money(total)}</p></div>
              <div><p className="text-xs text-zinc-400">Solde à payer</p><p className="text-xl font-bold text-[#FF6600]">{symbol}{money(remaining)}</p></div>
            </div>

            <div className="mt-5 rounded-xl border border-[#FF6600]/30 bg-[#FF6600]/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1"><span className="mb-2 block text-xs font-bold uppercase text-zinc-300">Remboursement partiel</span><input type="number" min="0.01" max={remaining} step="0.01" value={amounts[id] || ''} onChange={e => setAmounts(x => ({ ...x, [id]: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-[#000E38] px-4 py-3 text-white outline-none focus:border-[#FF6600]" placeholder={`Montant en ${currency}`} /></label>
                <button onClick={() => openRepayment(loan, amount)} className="rounded-lg bg-[#FF6600] px-5 py-3 font-bold">Rembourser</button>
                <button onClick={() => openRepayment(loan, remaining)} className="rounded-lg border border-[#FF6600] px-5 py-3 font-bold text-[#FF6600]">Solder toute la dette ({symbol}{money(remaining)})</button>
              </div>
            </div>

            {schedule.length > 0 && <section className="mt-5"><h2 className="mb-3 font-semibold">Échéancier de remboursement</h2><div className="space-y-2">{schedule.map((item: any, i: number) => <div key={item.id || i} className="rounded-lg border border-white/10 p-3"><div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><span>Échéance #{n(item.installment_number)} — {date(item.due_date)}</span><strong>{symbol}{money(item.remaining_amount)}</strong></div><p className="mt-1 text-xs text-zinc-400">Prévu : {symbol}{money(item.amount)} · Payé : {symbol}{money(item.paid_amount)}</p><p className="mt-1 text-xs">Statut : {String(item.status) === 'paid' ? 'Payée' : String(item.status) === 'partial' ? 'Partielle' : String(item.status) === 'overdue' ? 'En retard' : 'À payer'}{n(item.penalty_amount) > 0 ? ` · Pénalité : ${symbol}${money(item.penalty_amount)}` : ''}</p></div>)}</div></section>}
          </article>;
        })}
      </div>

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#071A4A] p-6 shadow-2xl"><h2 className="text-xl font-bold">Confirmer le remboursement</h2><p className="mt-2 text-zinc-300">Montant : {money(selected.amount)} {String((selected.loan as any).currency).toUpperCase()}</p><p className="mt-1 text-sm text-zinc-300">Le montant sera affecté à la dette LoanMe. Pour solder le crédit, le montant proposé est le solde total restant, intérêts et pénalités éventuelles compris.</p><input autoFocus type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0,6))} onKeyDown={e => e.key === 'Enter' && void confirm()} placeholder="PIN" className="mt-4 w-full rounded-lg border border-white/10 bg-[#000E38] px-4 py-3 text-center text-xl tracking-[0.5em]" />{error && <p className="mt-2 text-sm text-red-300">{error}</p>}<div className="mt-5 flex gap-2"><button onClick={() => {setSelected(null);setPin('');setError('')}} disabled={processing} className="flex-1 rounded-lg border border-white/10 px-4 py-3">Annuler</button><button onClick={() => void confirm()} disabled={processing || !pin} className="flex-1 rounded-lg bg-[#FF6600] px-4 py-3 font-bold">{processing ? 'Traitement…' : 'Confirmer'}</button></div></div></div>}
    </main>
  );
}
