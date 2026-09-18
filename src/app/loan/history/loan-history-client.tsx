'use client';

import type { LoanHistory } from '@/lib/actions/loan.actions';
import { getLoanOffer, repayLoan, repayLoanInstallment } from '@/lib/actions/loan.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { verifyUserPin } from '@/lib/actions/auth.actions';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  CDF: 'FC',
};

const ALLOWED_DURATIONS = [1, 3, 6, 12, 24] as const;
type DurationFilter = 'all' | (typeof ALLOWED_DURATIONS)[number];

type PinAction =
  | { kind: 'amount'; loan: LoanHistory; amount: number }
  | { kind: 'installment'; loan: LoanHistory; installmentId: number; amount: number }
  | null;

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getLoanId(loan: LoanHistory | any): number {
  return num(loan?.id ?? loan?.loan_id ?? loan?.loanId, 0);
}

function getUserId(user: any): number {
  if (typeof user === 'number' || typeof user === 'string') return num(user, 0);
  return num(user?.id ?? user?.user_id ?? user?.id_user, 0);
}

function money(value: unknown): string {
  return num(value).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safeDate(value: unknown): string {
  if (!value) return 'Date non disponible';

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Date non disponible';

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Détermine la durée affichée sans dépendre uniquement de loan.duration.
 * Le backend peut fournir duration, installment_count ou schedule.
 */
function getLoanDuration(loan: LoanHistory): number | null {
  const direct = num((loan as any).duration, 0);

  if ([1, 3, 6, 12, 24].includes(direct)) {
    return direct;
  }

  const installmentCount = num((loan as any).installment_count, 0);
  const scheduleLength = Array.isArray((loan as any).schedule)
    ? (loan as any).schedule.length
    : 0;

  // Le prêt d'un mois est hebdomadaire : généralement 4 échéances.
  if (installmentCount === 4 || installmentCount === 5 || scheduleLength === 4 || scheduleLength === 5) {
    return 1;
  }

  if ([3, 6, 12, 24].includes(installmentCount)) {
    return installmentCount;
  }

  if ([3, 6, 12, 24].includes(scheduleLength)) {
    return scheduleLength;
  }

  const start = new Date(String((loan as any).start_date || ''));
  const end = new Date(String((loan as any).end_date || ''));

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());

    if ([1, 3, 6, 12, 24].includes(months)) {
      return months;
    }

    // Tolérance pour les dates qui tombent quelques jours avant/après le même jour du mois.
    const approximate = Math.round((end.getTime() - start.getTime()) / (30.4375 * 24 * 60 * 60 * 1000));

    if ([1, 3, 6, 12, 24].includes(approximate)) {
      return approximate;
    }
  }

  return null;
}

function durationLabel(duration: number | null): string {
  if (duration === 1) return '1 mois';
  if (duration === 3) return '3 mois';
  if (duration === 6) return '6 mois';
  if (duration === 12) return '12 mois';
  if (duration === 24) return '24 mois';
  return 'Durée non déterminée';
}

function loanStatus(status: unknown): string {
  switch (String(status || '').toLowerCase()) {
    case 'pending':
      return 'En attente';
    case 'approved':
      return 'Actif';
    case 'repaid':
      return 'Remboursé';
    case 'rejected':
      return 'Refusé';
    case 'defaulted':
      return 'En défaut';
    default:
      return String(status || 'Inconnu');
  }
}

function installmentStatus(status: unknown): string {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return 'Payée';
    case 'partial':
      return 'Partielle';
    case 'overdue':
      return 'En retard';
    default:
      return 'À payer';
  }
}

export function LoanHistoryClient({
  initialHistory,
  userId,
}: {
  initialHistory: LoanHistory[];
  userId: number;
}) {
  const router = useRouter();

  const [repayAmounts, setRepayAmounts] = useState<Record<number, string>>({});
  const [repayingLoanId, setRepayingLoanId] = useState<number | null>(null);
  const [repayError, setRepayError] = useState<Record<number, string>>({});
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all');
  const [pinAction, setPinAction] = useState<PinAction>(null);
  const [pin, setPin] = useState('');
  const [processing, setProcessing] = useState(false);
  const [balanceMessage, setBalanceMessage] = useState('');

  const allHistory = Array.isArray(initialHistory) ? initialHistory : [];

  const history =
    durationFilter === 'all'
      ? allHistory
      : allHistory.filter(
          (loan) => getLoanDuration(loan) === durationFilter
        );

  function openAmountPayment(loan: LoanHistory) {
    const loanId = getLoanId(loan);
    const currentUserId = getUserId(userId);
    const amount = num(repayAmounts[loanId], 0);
    const remaining = Math.max(0, num((loan as any).remaining_balance, 0));

    setRepayError((prev) => ({ ...prev, [loanId]: '' }));
    if (!currentUserId) return setRepayError((prev) => ({ ...prev, [loanId]: 'Session utilisateur invalide.' }));
    if (!loanId) return setRepayError((prev) => ({ ...prev, [loanId]: 'Identifiant du crédit invalide.' }));
    if (amount <= 0) return setRepayError((prev) => ({ ...prev, [loanId]: 'Entrez un montant de remboursement valide.' }));
    if (amount > remaining + 0.005) return setRepayError((prev) => ({ ...prev, [loanId]: `Le montant ne peut pas dépasser le solde restant de ${money(remaining)} ${(loan as any).currency || ''}.` }));

    setPin('');
    setBalanceMessage('');
    setPinAction({ kind: 'amount', loan, amount });
  }

  function openInstallmentPayment(loan: LoanHistory, installment: any) {
    const loanId = getLoanId(loan);
    const installmentId = num(installment?.id, 0);
    const amount = Math.max(0, num(installment?.remaining_amount, 0));
    if (!getUserId(userId)) return setRepayError((prev) => ({ ...prev, [loanId]: 'Session utilisateur invalide.' }));
    if (!loanId || !installmentId) return setRepayError((prev) => ({ ...prev, [loanId]: 'Identifiant du crédit ou de l’échéance invalide.' }));
    if (amount <= 0.005) return setRepayError((prev) => ({ ...prev, [loanId]: 'Cette échéance est déjà soldée.' }));
    setRepayError((prev) => ({ ...prev, [loanId]: '' }));
    setPin('');
    setBalanceMessage('');
    setPinAction({ kind: 'installment', loan, installmentId, amount });
  }

  async function confirmPayment() {
    if (!pinAction) return;
    const currentUserId = getUserId(userId);
    const loanId = getLoanId(pinAction.loan);
    const errorKey = loanId;
    if (!currentUserId || !loanId) {
      setRepayError((prev) => ({ ...prev, [errorKey]: 'Identifiant du crédit ou session utilisateur invalide.' }));
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setRepayError((prev) => ({ ...prev, [errorKey]: 'Entrez votre code PIN.' }));
      return;
    }

    setProcessing(true);
    setRepayError((prev) => ({ ...prev, [errorKey]: '' }));
    setBalanceMessage('');
    try {
      const pinResult = await verifyUserPin(currentUserId, pin);
      if (!pinResult?.success) {
        setRepayError((prev) => ({ ...prev, [errorKey]: pinResult?.error || 'Code PIN incorrect.' }));
        return;
      }

      const currency = String((pinAction.loan as any).currency || '').toUpperCase();
      const offer = await getLoanOffer(currentUserId, currency);
      const balance = num(offer?.balance, 0);
      if (balance + 0.005 < pinAction.amount) {
        setRepayError((prev) => ({ ...prev, [errorKey]: `Solde insuffisant. Votre solde ${currency} disponible est de ${money(balance)} ${currency}.` }));
        return;
      }
      setBalanceMessage(`Solde vérifié : ${money(balance)} ${currency}.`);

      const result = pinAction.kind === 'installment'
        ? await repayLoanInstallment(currentUserId, loanId, pinAction.installmentId)
        : await repayLoan(currentUserId, loanId, pinAction.amount);

      if (!result?.success) {
        setRepayError((prev) => ({ ...prev, [errorKey]: result?.error || 'Remboursement impossible.' }));
        return;
      }

      setPinAction(null);
      setPin('');
      setBalanceMessage('');
      setRepayAmounts((prev) => ({ ...prev, [loanId]: '' }));
      router.refresh();
    } catch (error) {
      setRepayError((prev) => ({ ...prev, [errorKey]: error instanceof Error ? error.message : 'Une erreur est survenue pendant le remboursement.' }));
    } finally {
      setProcessing(false);
    }
  }


  return (
    <main className="min-h-full rounded-2xl bg-[#000E38] p-4 text-white md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Historique des crédits</h1>
          <p className="mt-1 text-zinc-300">
            Consultez vos crédits, vos échéances et vos remboursements.
          </p>
        </header>

        <section className="rounded-xl border border-white/10 bg-[#071a4a] p-4">
          <h2 className="mb-3 font-bold">Filtrer par durée</h2>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {(['all', ...ALLOWED_DURATIONS] as const).map((value) => {
              const checked = durationFilter === value;
              const label =
                value === 'all' ? 'Toutes' : `${value} mois`;

              return (
                <label
                  key={String(value)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                    checked
                      ? 'border-[#FF6600] bg-[#FF6600]/10'
                      : 'border-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    name="loan-duration"
                    value={String(value)}
                    checked={checked}
                    onChange={() => setDurationFilter(value)}
                    className="h-4 w-4 accent-[#FF6600]"
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </section>

        {history.length === 0 ? (
          <section className="rounded-xl border border-white/10 bg-[#071a4a] p-8 text-center">
            <h2 className="font-semibold">Aucun crédit trouvé</h2>
            <p className="mt-1 text-sm text-zinc-300">
              Aucun crédit ne correspond à la durée sélectionnée.
            </p>
          </section>
        ) : (
          <div className="space-y-5">
            {history.map((loan) => {
              const loanId = getLoanId(loan);
              const currency = String((loan as any).currency || '');
              const symbol = currencySymbols[currency] || currency;

              const principal = Math.max(0, num((loan as any).principal_amount, num((loan as any).amount, 0)));
              const repaid = Math.max(
                0,
                num((loan as any).repaid_amount, 0)
              );
              const remaining = Math.max(
                0,
                num((loan as any).remaining_balance, Math.max(0, principal - repaid))
              );

              const totalRepayment = Math.max(
                principal,
                num((loan as any).total_repayment, 0),
                repaid + remaining
              );

              const progress =
                totalRepayment > 0
                  ? Math.min(100, Math.max(0, (repaid / totalRepayment) * 100))
                  : 0;

              const status = String((loan as any).status || '').toLowerCase();
              const canRepay = status === 'approved' && remaining > 0.005;
              const duration = getLoanDuration(loan);
              const schedule = Array.isArray((loan as any).schedule)
                ? (loan as any).schedule
                : [];
              const currentInstallment = schedule.find((item: any) => {
                const itemStatus = String(item?.status || '').toLowerCase();
                return itemStatus !== 'paid' && num(item?.remaining_amount, 0) > 0.005;
              });
              const currentInstallmentRemaining = currentInstallment
                ? Math.max(0, num(currentInstallment.remaining_amount, 0))
                : 0;

              return (
                <article
                  key={loanId}
                  className="rounded-xl border border-white/10 bg-[#071a4a] p-4 md:p-5"
                >
                  <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold">
                        Crédit {symbol}
                        {money(principal)}
                      </h2>

                      <p className="mt-1 text-sm text-zinc-300">
                        Durée : {durationLabel(duration)}
                      </p>

                      <p className="text-xs text-zinc-400">
                        Du {safeDate((loan as any).start_date)} au{' '}
                        {safeDate((loan as any).end_date)}
                      </p>
                    </div>

                    <span className="w-fit rounded-full border border-[#FF6600]/40 px-3 py-1 text-xs font-semibold text-[#FF6600]">
                      {loanStatus((loan as any).status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-white/10 p-3">
                      <p className="text-xs text-zinc-400">Montant</p>
                      <p className="mt-1 font-semibold">
                        {symbol}
                        {money(principal)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/10 p-3">
                      <p className="text-xs text-zinc-400">Remboursé</p>
                      <p className="mt-1 font-semibold">
                        {symbol}
                        {money(repaid)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/10 p-3">
                      <p className="text-xs text-zinc-400">Solde restant</p>
                      <p className="mt-1 font-semibold text-[#FF6600]">
                        {symbol}
                        {money(remaining)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex justify-between text-xs text-zinc-300">
                      <span>Progression du remboursement</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#FF6600]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <span className="text-zinc-400">Échéances : </span>
                      <span className="font-semibold">
                        {num((loan as any).installment_count, (loan as any).schedule?.length || 0)}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-400">Fréquence : </span>
                      <span className="font-semibold">
                        {String((loan as any).repayment_frequency || '').toLowerCase() === 'weekly'
                          ? 'Hebdomadaire'
                          : 'Mensuelle'}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-400">Total à rembourser : </span>
                      <span className="font-semibold">
                        {symbol}
                        {money(totalRepayment)}
                      </span>
                    </div>
                  </div>

                  {canRepay && (
                    <section className="mt-5 rounded-lg border border-[#FF6600]/30 bg-[#FF6600]/10 p-4">
                      <h3 className="font-bold">Rembourser maintenant</h3>

                      <p className="mt-1 text-sm text-zinc-300">
                        Le remboursement est manuel. Le montant est affecté à
                        la première échéance non soldée, puis aux suivantes.
                      </p>

                      {currentInstallment && currentInstallmentRemaining > 0.005 && (
                        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-white/10 bg-[#000E38]/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">
                              Échéance #{num(currentInstallment?.installment_number, 0)}
                            </p>
                            <p className="text-xs text-zinc-300">
                              Reste à solder : {symbol}{money(currentInstallmentRemaining)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openInstallmentPayment(loan, currentInstallment)}
                            disabled={repayingLoanId === loanId}
                            className="rounded-lg border border-[#FF6600] px-4 py-2 text-sm font-semibold text-[#FF6600] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {repayingLoanId === loanId ? 'Traitement...' : 'Solder l’échéance'}
                          </button>
                        </div>
                      )}

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="number"
                          min="0.01"
                          max={remaining > 0 ? remaining : undefined}
                          step="0.01"
                          inputMode="decimal"
                          placeholder={`Montant en ${currency}`}
                          value={repayAmounts[loanId] || ''}
                          onChange={(event) =>
                            setRepayAmounts((prev) => ({
                              ...prev,
                              [loanId]: event.target.value,
                            }))
                          }
                          disabled={repayingLoanId === loanId}
                          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#000E38] px-3 py-2 text-white outline-none focus:border-[#FF6600]"
                        />

                        <button
                          type="button"
                          onClick={() => openAmountPayment(loan)}
                          disabled={repayingLoanId === loanId}
                          className="rounded-lg bg-[#FF6600] px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {repayingLoanId === loanId
                            ? 'Traitement...'
                            : 'Rembourser'}
                        </button>
                      </div>

                      {repayError[loanId] ? (
                        <p className="mt-2 text-sm text-red-200">
                          {repayError[loanId]}
                        </p>
                      ) : null}
                    </section>
                  )}

                  {Array.isArray((loan as any).schedule) &&
                    (loan as any).schedule.length > 0 && (
                      <section className="mt-5">
                        <h3 className="mb-3 font-semibold">
                          Échéancier de remboursement
                        </h3>

                        <div className="space-y-2">
                          {(loan as any).schedule.map(
                            (item: any, index: number) => (
                              <div
                                key={item?.id ?? `${loanId}-schedule-${index}`}
                                className="rounded-lg border border-white/10 p-3"
                              >
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="text-sm">
                                    Échéance du {safeDate(item?.due_date)}
                                  </span>

                                  <span className="font-semibold">
                                    {symbol}
                                    {money(item?.remaining_amount)}
                                  </span>
                                </div>

                                <p className="mt-1 text-xs text-zinc-400">
                                  Montant prévu : {symbol}
                                  {money(item?.amount)}
                                </p>

                                <p className="mt-1 text-xs font-semibold">
                                  Statut : {installmentStatus(item?.status)}
                                </p>

                                {num(item?.penalty_amount, 0) > 0 && (
                                  <p className="mt-1 text-xs text-[#FF6600]">
                                    Pénalité : {symbol}
                                    {money(item?.penalty_amount)}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </section>
                    )}

                  {Array.isArray((loan as any).repayments) &&
                    (loan as any).repayments.length > 0 && (
                      <section className="mt-5">
                        <h3 className="mb-3 font-semibold">
                          Historique des remboursements
                        </h3>

                        <div className="space-y-1">
                          {(loan as any).repayments.map(
                            (repayment: any, index: number) => {
                              const isPenalty =
                                String(repayment?.type || '').toLowerCase() ===
                                'penalty';

                              return (
                                <div
                                  key={
                                    repayment?.id ??
                                    `${loanId}-repayment-${index}`
                                  }
                                  className="flex flex-col gap-1 border-b border-white/10 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <span>
                                    {safeDate(repayment?.payment_date)}
                                  </span>

                                  <span>
                                    {isPenalty
                                      ? 'Pénalité'
                                      : 'Remboursement'}
                                  </span>

                                  <strong
                                    className={
                                      isPenalty
                                        ? 'text-[#FF6600]'
                                        : 'text-white'
                                    }
                                  >
                                    {isPenalty ? '+' : '-'}
                                    {symbol}
                                    {money(repayment?.amount)}
                                  </strong>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </section>
                    )}

                  <p className="mt-5 border-t border-white/10 pt-4 text-xs text-zinc-400">
                    Pensez à rembourser vos échéances à temps afin d’éviter les
                    pénalités et de conserver votre progression LoanMe.
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {pinAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#071A4A] p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Confirmer le remboursement</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Montant : {money(pinAction.amount)} {String((pinAction.loan as any).currency || '').toUpperCase()}
            </p>
            <p className="mt-1 text-sm text-zinc-300">
              {pinAction.kind === 'installment' ? `Solder l’échéance #${pinAction.installmentId}.` : 'Remboursement anticipé ou partiel du crédit.'}
              {' '}Entrez votre PIN pour autoriser le débit de votre compte principal.
            </p>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(event) => { if (event.key === 'Enter') void confirmPayment(); }}
              placeholder="PIN"
              className="mt-4 w-full rounded-lg border border-white/10 bg-[#000E38] px-4 py-3 text-center text-xl tracking-[0.5em] outline-none focus:border-[#FF6600]"
            />
            {balanceMessage && <p className="mt-2 text-sm text-green-300">{balanceMessage}</p>}
            {repayError[getLoanId(pinAction.loan)] && <p className="mt-2 text-sm text-red-300">{repayError[getLoanId(pinAction.loan)]}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" disabled={processing} onClick={() => { setPinAction(null); setPin(''); setBalanceMessage(''); }} className="flex-1 rounded-lg border border-white/10 px-4 py-3 font-semibold disabled:opacity-50">Annuler</button>
              <button type="button" disabled={processing || !pin} onClick={() => void confirmPayment()} className="flex-1 rounded-lg bg-[#FF6600] px-4 py-3 font-semibold disabled:opacity-50">
                {processing ? 'Traitement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default LoanHistoryClient;
