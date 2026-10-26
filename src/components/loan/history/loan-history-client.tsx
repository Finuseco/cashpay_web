'use client';

import type { LoanHistory } from '@/lib/actions/loan.actions';
import { repayLoan } from '@/lib/actions/loan.actions';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Duration = 'all' | 1 | 3 | 6 | 12 | 24;

const DURATIONS: Duration[] = ['all', 1, 3, 6, 12, 24];
const SYMBOLS: Record<string, string> = { CDF: 'FC', USD: '$', EUR: '€' };

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v: unknown): string {
  return num(v).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function symbol(v: unknown): string {
  const c = String(v || '').toUpperCase();
  return SYMBOLS[c] || c;
}

const JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

function date(v: unknown): string {
  if (!v) return 'Non disponible';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime())
    ? 'Non disponible'
    : d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
}

/** Retourne "Lundi 14 avril 2025 à 10h30" */
function dateWithDay(v: unknown): { line1: string; line2: string } | null {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  const jour = JOURS[d.getDay()];
  const datePart = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return {
    line1: `${jour} ${datePart}`,
    line2: `à ${h}h${m}`,
  };
}

/* Le backend fournit duration. Les autres règles servent seulement aux anciennes lignes. */
function durationOf(loan: LoanHistory): number | null {
  const direct = Math.trunc(num((loan as any).duration));
  if ([1, 3, 6, 12, 24].includes(direct)) return direct;

  const count = Math.trunc(num((loan as any).installment_count));
  if ([3, 6, 12, 24].includes(count)) return count;

  const schedule = Array.isArray((loan as any).schedule)
    ? (loan as any).schedule
    : [];

  const frequency = String(
    (loan as any).repayment_frequency || '',
  ).toLowerCase();

  if (
    frequency === 'weekly' &&
    (count === 4 || count === 5 || schedule.length === 4 || schedule.length === 5)
  ) {
    return 1;
  }

  if ([3, 6, 12, 24].includes(schedule.length)) return schedule.length;

  const start = new Date(
    String((loan as any).start_date || (loan as any).approval_date || ''),
  );
  const end = new Date(String((loan as any).end_date || ''));

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      end.getMonth() -
      start.getMonth();

    if ([1, 3, 6, 12, 24].includes(months)) return months;
  }

  return null;
}

function statusOf(v: unknown): string {
  switch (String(v || '').toLowerCase()) {
    case 'pending': return 'En attente';
    case 'approved': return 'Actif';
    case 'rejected': return 'Refusé';
    case 'repaid': return 'Remboursé';
    case 'defaulted': return 'En défaut';
    default: return 'Inconnu';
  }
}

function installmentStatus(v: unknown): string {
  switch (String(v || '').toLowerCase()) {
    case 'paid': return 'Payée';
    case 'partial': return 'Partielle';
    case 'overdue': return 'En retard';
    default: return 'À payer';
  }
}

/** Retourne le label "X jours restants" / "Dépassé de X jours" / null si déjà payée */
function daysLabel(dueDate: unknown, status: unknown): { text: string; overdue: boolean } | null {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return null; // payée, pas besoin d'afficher

  if (!dueDate) return null;
  const due = new Date(String(dueDate));
  if (Number.isNaN(due.getTime())) return null;

  const now = new Date();
  // Comparer seulement les dates (ignorer l'heure)
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dueMs = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueMs - todayMs) / 86_400_000);

  if (diffDays > 0) {
    return { text: `${diffDays} jour${diffDays > 1 ? 's' : ''} restant${diffDays > 1 ? 's' : ''}`, overdue: false };
  } else if (diffDays === 0) {
    return { text: "Aujourd'hui", overdue: false };
  } else {
    const abs = Math.abs(diffDays);
    return { text: `Dépassé de ${abs} jour${abs > 1 ? 's' : ''}`, overdue: true };
  }
}

export function LoanHistoryClient({
  initialHistory,
}: {
  initialHistory: LoanHistory[];
}) {
  const router = useRouter();
  const [selectedDuration, setSelectedDuration] = useState<Duration>('all');
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [processing, setProcessing] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const source = Array.isArray(initialHistory) ? initialHistory : [];
  const history =
    selectedDuration === 'all'
      ? source
      : source.filter((loan) => durationOf(loan) === selectedDuration);

  async function repay(loan: LoanHistory) {
    const id = Number(loan.id);
    const userId = Number((loan as any).user_id);
    const amount = Number(amounts[id]);
    const remaining = num((loan as any).remaining_balance);

    if (!Number.isInteger(id) || id <= 0) {
      setErrors((x) => ({ ...x, [id]: 'Identifiant du crédit invalide.' }));
      return;
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      setErrors((x) => ({ ...x, [id]: 'Utilisateur du crédit introuvable.' }));
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrors((x) => ({ ...x, [id]: 'Entrez un montant valide.' }));
      return;
    }

    if (remaining > 0 && amount > remaining + 0.01) {
      setErrors((x) => ({
        ...x,
        [id]: `Le montant ne peut pas dépasser ${money(remaining)} ${String(loan.currency || '')}.`,
      }));
      return;
    }

    setProcessing(id);
    setErrors((x) => ({ ...x, [id]: '' }));

    try {
      const result = await repayLoan(userId, id, amount);

      if (!result.success) {
        setErrors((x) => ({
          ...x,
          [id]: result.error || 'Remboursement impossible.',
        }));
        setProcessing(null);
        return;
      }

      setAmounts((x) => ({ ...x, [id]: '' }));
      setProcessing(null);
      router.refresh();
    } catch (error: any) {
      setErrors((x) => ({
        ...x,
        [id]: error?.message || 'Une erreur est survenue.',
      }));
      setProcessing(null);
    }
  }

  return (
    <main className="min-h-full w-full bg-[#000E38] px-4 py-6 text-white md:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">Historique LoanMe</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Consultez tous vos crédits, échéances et remboursements.
          </p>
        </header>

        <section className="mb-6 rounded-xl border border-white/10 bg-[#071A4A] p-4">
          <h2 className="mb-3 font-semibold">Filtrer par durée</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {DURATIONS.map((value) => (
              <label
                key={String(value)}
                className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3"
              >
                <input
                  type="radio"
                  name="loan-history-duration"
                  checked={selectedDuration === value}
                  onChange={() => setSelectedDuration(value)}
                  className="h-4 w-4 accent-[#FF6600]"
                />
                <span>{value === 'all' ? 'Tous' : `${value} mois`}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-400">
            {history.length} crédit{history.length > 1 ? 's' : ''} affiché{history.length > 1 ? 's' : ''}.
          </p>
        </section>

        {history.length === 0 ? (
          <section className="rounded-xl border border-white/10 bg-[#071A4A] p-8 text-center">
            <h2 className="text-xl font-semibold">Aucun crédit trouvé</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Aucune donnée ne correspond à la durée sélectionnée.
            </p>
          </section>
        ) : (
          <div className="space-y-6">
            {history.map((loan) => {
              const id = Number(loan.id);
              const currency = String(loan.currency || '').toUpperCase();
              const s = symbol(currency);
              const principal = num((loan as any).amount);
              const remaining = Math.max(0, num((loan as any).remaining_balance));
              const repaid = Math.max(0, principal - remaining);
              const progress =
                principal > 0
                  ? Math.min(100, Math.max(0, (repaid / principal) * 100))
                  : 0;
              const duration = durationOf(loan);
              const status = String(loan.status || '').toLowerCase();
              const schedule = Array.isArray((loan as any).schedule)
                ? (loan as any).schedule
                : [];
              const repayments = Array.isArray((loan as any).repayments)
                ? (loan as any).repayments
                : [];
              const active = status === 'approved' && remaining > 0.005;

              return (
                <article
                  key={id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-[#071A4A]"
                >
                  <div className="border-b border-white/10 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#FF6600]">
                          Crédit #{id}
                        </p>
                        <h2 className="mt-1 text-3xl font-bold">
                          {s}{money(principal)}
                        </h2>
                        <p className="mt-1 text-sm text-zinc-300">
                          {duration ? `Durée : ${duration} mois` : 'Durée : non déterminée'}
                        </p>
                      </div>
                      <div className="rounded-full border border-[#FF6600]/50 px-4 py-2 text-sm font-semibold text-[#FF6600]">
                        {statusOf(status)}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-zinc-400">Début</p>
                      {(() => {
                        const dd = dateWithDay((loan as any).start_date || (loan as any).approval_date || (loan as any).request_date);
                        return dd ? (
                          <p className="mt-1 text-sm leading-snug">
                            <span className="font-medium">{dd.line1}</span><br/>
                            <span className="text-zinc-400">{dd.line2}</span>
                          </p>
                        ) : <p className="mt-1 text-sm text-zinc-400">Non disponible</p>;
                      })()}
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Fin prévue</p>
                      {(() => {
                        const dd = dateWithDay((loan as any).end_date);
                        return dd ? (
                          <p className="mt-1 text-sm leading-snug">
                            <span className="font-medium">{dd.line1}</span><br/>
                            <span className="text-zinc-400">{dd.line2}</span>
                          </p>
                        ) : <p className="mt-1 text-sm text-zinc-400">Non disponible</p>;
                      })()}
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Nombre d'échéances</p>
                      <p className="mt-1 text-sm">
                        {num((loan as any).installment_count) || schedule.length || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">Fréquence</p>
                      <p className="mt-1 text-sm">
                        {String((loan as any).repayment_frequency || '').toLowerCase() === 'weekly'
                          ? 'Hebdomadaire'
                          : 'Mensuelle'}
                      </p>
                    </div>
                  </div>

                  <div className="border-b border-white/10 p-5">
                    <div className="flex justify-between text-sm">
                      <span>Remboursé</span>
                      <strong>{s}{money(repaid)} / {s}{money(principal)}</strong>
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-[#FF6600]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-3 flex justify-between text-sm">
                      <span className="text-zinc-300">Progression : {progress.toFixed(0)} %</span>
                      <span>Reste : <strong>{s}{money(remaining)}</strong></span>
                    </div>
                  </div>

                  {active && (
                    <section className="border-b border-white/10 bg-[#000E38] p-5">
                      <h3 className="font-semibold text-[#FF6600]">
                        Remboursement manuel
                      </h3>
                      <p className="mt-2 text-sm text-zinc-300">
                        Entrez le montant à rembourser. Le système affecte le paiement aux premières échéances non soldées.
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                          type="number"
                          min="0.01"
                          max={remaining > 0 ? remaining : undefined}
                          step="0.01"
                          inputMode="decimal"
                          value={amounts[id] || ''}
                          onChange={(e) => setAmounts((x) => ({ ...x, [id]: e.target.value }))}
                          disabled={processing === id}
                          placeholder={`Montant en ${currency}`}
                          className="min-h-[46px] rounded-lg border border-white/15 bg-[#071A4A] px-4 text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => repay(loan)}
                          disabled={processing === id}
                          className="min-h-[46px] rounded-lg bg-[#FF6600] px-6 font-semibold disabled:opacity-60"
                        >
                          {processing === id ? 'Traitement...' : 'Rembourser'}
                        </button>
                      </div>
                      {errors[id] ? (
                        <p className="mt-3 text-sm text-red-300">{errors[id]}</p>
                      ) : null}
                    </section>
                  )}

                  <section className="border-b border-white/10 p-5">
                    <h3 className="mb-4 font-semibold">Échéancier</h3>
                    {schedule.length === 0 ? (
                      <p className="text-sm text-zinc-400">Aucun échéancier disponible.</p>
                    ) : (
                      <div className="space-y-2">
                        {schedule.map((item: any, index: number) => {
                          const dl = daysLabel(item.due_date, item.status);
                          return (
                          <div
                            key={Number(item.id) || `${id}-${index}`}
                            className="rounded-lg border border-white/10 bg-[#000E38] p-4"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium">
                                    Échéance #{num(item.installment_number) || index + 1}
                                  </p>
                                  {dl && (
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      dl.overdue
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-emerald-500/20 text-emerald-400'
                                    }`}>
                                      {dl.text}
                                    </span>
                                  )}
                                </div>
                                {(() => {
                                  const dd = dateWithDay(item.due_date);
                                  return dd ? (
                                    <p className="mt-1 text-xs leading-snug">
                                      <span className="font-medium text-white/80">{dd.line1}</span>
                                      <span className="ml-1 text-zinc-400">{dd.line2}</span>
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-xs text-zinc-400">Date non disponible</p>
                                  );
                                })()}
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">
                                  {s}{money(item.amount)}
                                </p>
                                <p className="text-xs text-zinc-400">
                                  Reste : {s}{money(item.remaining_amount)}
                                </p>
                              </div>
                            </div>
                            <p className="mt-3 text-xs">
                              Statut : {installmentStatus(item.status)}
                            </p>
                            {num(item.penalty ?? item.penalty_amount) > 0 && (
                              <p className="mt-2 text-xs text-[#FF6600]">
                                Pénalité : {s}{money(item.penalty ?? item.penalty_amount)}
                              </p>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="p-5">
                    <h3 className="mb-4 font-semibold">
                      Historique des remboursements
                    </h3>
                    {repayments.length === 0 ? (
                      <p className="text-sm text-zinc-400">
                        Aucun remboursement enregistré.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {repayments.map((repayment: any, index: number) => {
                          const penalty =
                            String(repayment.type || '').toLowerCase() === 'penalty';
                          return (
                            <div
                              key={Number(repayment.id) || `${id}-rep-${index}`}
                              className="flex flex-col gap-2 rounded-lg border border-white/10 bg-[#000E38] p-4 sm:flex-row sm:justify-between"
                            >
                              <div>
                                <p className="font-medium">
                                  {penalty ? 'Pénalité' : 'Remboursement'}
                                </p>
                                {(() => {
                                  const dd = dateWithDay(repayment.payment_date);
                                  return dd ? (
                                    <p className="text-xs leading-snug">
                                      <span className="text-zinc-300">{dd.line1}</span>
                                      <span className="ml-1 text-zinc-400">{dd.line2}</span>
                                    </p>
                                  ) : (
                                    <p className="text-xs text-zinc-400">Date inconnue</p>
                                  );
                                })()}
                                {repayment.installment_number ? (
                                  <p className="mt-1 text-xs text-zinc-400">
                                    Échéance #{repayment.installment_number}
                                  </p>
                                ) : null}
                              </div>
                              <strong className={penalty ? 'text-[#FF6600]' : 'text-white'}>
                                {penalty ? '+' : '-'}{s}{money(repayment.amount)}
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <footer className="border-t border-white/10 px-5 py-4 text-xs text-zinc-400">
                    Payez vos échéances à temps pour éviter les pénalités et conserver votre progression LoanMe.
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default LoanHistoryClient;
