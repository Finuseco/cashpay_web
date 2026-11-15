/** Only approval starts a contractual calendar. Dates are full instants, never request-date estimates. */
export function loanCalendarMetadata(loan: {status?: unknown; request_date?: unknown; approval_date?: unknown}, dueDates: unknown[]) {
  const iso = (value: unknown): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  };
  const requested = iso(loan.request_date);
  const approved = ['pending','rejected','cancelled','canceled'].includes(String(loan.status || '').toLowerCase()) ? null : iso(loan.approval_date);
  const dates = approved ? dueDates.map(iso).filter((date): date is string => date !== null).sort() : [];
  return {request_date: requested, approval_date: approved, start_date: approved, end_date: dates.at(-1) ?? null};
}
