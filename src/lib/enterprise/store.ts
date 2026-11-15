export type EnterpriseDb = {
  query(
    sql: string,
    params?: any[],
  ): Promise<{ rows: any[]; rowCount?: number | null }>;
};
export const EVENT_TYPES = [
  "ENTERPRISE_CONFIG",
  "ENTERPRISE_EMPLOYEE",
  "ENTERPRISE_MEMBER",
  "ENTERPRISE_ADJUST",
  "ENTERPRISE_PAID",
  "ENTERPRISE_BILL",
] as const;
export type EnterpriseRole = "manager" | "treasurer" | "accountant" | "cashier";
export type Config = {
  key: string;
  active: boolean;
  managerId: number;
  monthlyCurrency: string;
  billingFrom: string;
  companyName: string;
};
export type Employee = {
  key: string;
  userId: number;
  walletId: string;
  name: string;
  salary: string;
  currency: string;
  startMonth: string;
  active: boolean;
};
export type Member = {
  key: string;
  userId: number;
  role: EnterpriseRole;
  active: boolean;
  name: string;
  walletId: string;
};
export type Adjustment = {
  key: string;
  userId: number;
  amount: string;
  currency: string;
  month: string;
  reason: string;
  status: "pending" | "approved" | "disputed" | "rejected";
  createdBy: number;
  approvedBy?: number;
};
export type PayrollLine = {
  userId: number;
  walletId: string;
  name: string;
  months: string[];
  gross: string;
  deduction: string;
  net: string;
  allocations: { key: string; amount: string }[];
};
export type Payment = {
  key: string;
  currency: string;
  periods: string[];
  lines: PayrollLine[];
  reference: string;
  actorId: number;
};
export type Bill = {
  key: string;
  amount: string;
  currency: string;
  status: "pending" | "paid";
  reference?: string;
};
export type State = {
  revision: number;
  config: Config | null;
  employees: Record<string, Employee>;
  members: Record<string, Member>;
  adjustments: Record<string, Adjustment>;
  payments: Payment[];
  bills: Record<string, Bill>;
};
export function foldEvents(rows: any[]): State {
  const state: State = {
    revision: 0,
    config: null,
    employees: {},
    members: {},
    adjustments: {},
    payments: [],
    bills: {},
  };
  for (const row of rows) {
    const data =
      typeof row.detail === "string" ? JSON.parse(row.detail) : row.detail;
    if (!data || typeof data.key !== "string")
      throw Error("Journal entreprise invalide.");
    state.revision = Math.max(state.revision, Number(row.id));
    switch (row.action_type) {
      case "ENTERPRISE_CONFIG":
        state.config = data;
        break;
      case "ENTERPRISE_EMPLOYEE":
        state.employees[data.key] = data;
        break;
      case "ENTERPRISE_MEMBER":
        state.members[data.key] = data;
        break;
      case "ENTERPRISE_ADJUST":
        state.adjustments[data.key] = data;
        break;
      case "ENTERPRISE_PAID":
        state.payments.push(data);
        break;
      case "ENTERPRISE_BILL":
        state.bills[data.key] = data;
        break;
    }
  }
  return state;
}
export async function readState(c: EnterpriseDb, companyId: number) {
  const { rows } = await c.query(
    "SELECT id,action_type,detail,admin_user_id,created_at FROM super_agent_interventions WHERE target_user_id=$1 AND action_type=ANY($2::text[]) ORDER BY id",
    [companyId, [...EVENT_TYPES]],
  );
  return foldEvents(rows);
}
export async function event(
  c: EnterpriseDb,
  actorId: number,
  companyId: number,
  type: (typeof EVENT_TYPES)[number],
  data: object,
) {
  await c.query(
    "INSERT INTO super_agent_interventions(admin_user_id,target_user_id,action_type,detail) VALUES($1,$2,$3,$4)",
    [actorId, companyId, type, JSON.stringify(data)],
  );
}
export function cents(value: unknown): bigint {
  const raw = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw))
    throw Error("Montant invalide : deux décimales maximum.");
  const [whole, fraction = ""] = raw.split(".");
  const n = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (n > BigInt(100000000000000)) throw Error("Montant hors limite.");
  return n;
}
export function funds(value: unknown): bigint {
  const raw = String(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) throw Error("Solde non numérique.");
  if (raw.startsWith("-")) return BigInt(0);
  const [whole, fraction = ""] = raw.split(".");
  return (
    BigInt(whole) * BigInt(100) + BigInt(fraction.slice(0, 2).padEnd(2, "0"))
  );
}
export function decimal(value: bigint) {
  if (value < BigInt(0)) throw Error("Montant négatif interdit.");
  return `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
}
export function monthsBetween(start: string, end: string) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(start) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(end)
  )
    throw Error("Mois invalide.");
  const result: string[] = [];
  let [y, m] = start.split("-").map(Number);
  while (`${y}-${String(m).padStart(2, "0")}` <= end) {
    result.push(`${y}-${String(m).padStart(2, "0")}`);
    if (result.length > 600) throw Error("Historique mensuel hors limite.");
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return result;
}
export async function clock(c: EnterpriseDb) {
  return (
    await c.query(
      `SELECT to_char(CURRENT_DATE,'YYYY-MM') AS month,to_char(CASE WHEN CURRENT_TIMESTAMP >= date_trunc('month',CURRENT_TIMESTAMP)+INTERVAL '1 month'-INTERVAL '1 minute' THEN CURRENT_DATE ELSE (date_trunc('month',CURRENT_DATE)-INTERVAL '1 day')::date END,'YYYY-MM') AS due_through`,
    )
  ).rows[0] as { month: string; due_through: string };
}
export async function monthlyTariff(
  c: EnterpriseDb,
  currency: string,
  country: string,
) {
  const { rows } = await c.query(
    "SELECT fee_tiers FROM fee_structures WHERE transaction_type='ENTERPRISE_MONTHLY' AND currency=$1 AND country_code=ANY($2::text[]) AND is_active=TRUE ORDER BY CASE WHEN country_code=$3 THEN 0 ELSE 1 END",
    [currency, [country, "GBL"], country],
  );
  if (!rows.length)
    throw Error(
      "Forfait ENTERPRISE_MONTHLY non configuré pour cette devise et ce pays.",
    );
  const tiers =
    typeof rows[0].fee_tiers === "string"
      ? JSON.parse(rows[0].fee_tiers)
      : rows[0].fee_tiers;
  if (
    !Array.isArray(tiers) ||
    tiers.length !== 1 ||
    Number(tiers[0].min) !== 0 ||
    Number(tiers[0].max) !== 0 ||
    String(tiers[0].fee).includes("%")
  )
    throw Error(
      "Le forfait entreprise doit être un montant fixe avec un seul palier 0 / 0.",
    );
  const amount = cents(tiers[0].fee);
  if (amount <= BigInt(0))
    throw Error("Le forfait mensuel doit être supérieur à zéro.");
  return decimal(amount);
}
export function outstandingPeriods(state: State, through: string) {
  return state.config
    ? monthsBetween(state.config.billingFrom, through).filter(
        (month) => state.bills[month]?.status !== "paid",
      )
    : [];
}
export function planPayroll(
  state: State,
  userIds: number[],
  periods: string[],
  currency: string,
  currentMonth: string,
) {
  if (
    !userIds.length ||
    userIds.length > 200 ||
    new Set(userIds).size !== userIds.length ||
    !periods.length ||
    periods.length > 12 ||
    new Set(periods).size !== periods.length
  )
    throw Error("Sélectionnez au plus 200 salariés et 12 mois distincts.");
  const sorted = [...periods].sort();
  for (const month of sorted)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month > currentMonth)
      throw Error("Mois de salaire invalide ou futur.");
  const consumed: Record<string, bigint> = {};
  for (const pay of state.payments)
    for (const line of pay.lines)
      for (const allocation of line.allocations)
        consumed[allocation.key] =
          (consumed[allocation.key] || BigInt(0)) + cents(allocation.amount);
  return userIds.map((id) => {
    const employee = state.employees[String(id)];
    if (
      !employee?.active ||
      employee.currency !== currency ||
      sorted[0] < employee.startMonth
    )
      throw Error("Salarié, devise ou période non autorisé.");
    if (
      state.payments.some((pay) =>
        pay.lines.some(
          (line) =>
            line.userId === id &&
            line.months.some((month) => sorted.includes(month)),
        ),
      )
    )
      throw Error(`Une période a déjà été payée à ${employee.name}.`);
    const deductions = Object.values(state.adjustments).filter(
      (adj) =>
        adj.userId === id &&
        adj.currency === currency &&
        adj.month <= sorted[sorted.length - 1],
    );
    if (deductions.some((adj) => ["pending", "disputed"].includes(adj.status)))
      throw Error(
        `Retenue en attente ou litige non résolu pour ${employee.name}.`,
      );
    const gross = cents(employee.salary) * BigInt(sorted.length);
    let available = gross;
    const allocations: { key: string; amount: string }[] = [];
    for (const adj of deductions
      .filter((a) => a.status === "approved")
      .sort((a, b) => a.month.localeCompare(b.month))) {
      const remaining = cents(adj.amount) - (consumed[adj.key] || BigInt(0));
      if (remaining < BigInt(0)) throw Error("Retenue incohérente.");
      const amount = remaining < available ? remaining : available;
      if (amount > BigInt(0)) {
        allocations.push({ key: adj.key, amount: decimal(amount) });
        available -= amount;
      }
    }
    return {
      userId: id,
      walletId: employee.walletId,
      name: employee.name,
      months: sorted,
      gross: decimal(gross),
      deduction: decimal(gross - available),
      net: decimal(available),
      allocations,
    };
  });
}
