import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import type { PoolClient } from "pg";
import type { EnterpriseDb } from "./store";
import { countryToCode } from "@/lib/utils";
import { assertManagedUser } from "@/lib/super-agent-access";
import { createTransaction } from "@/lib/actions/transaction.actions";
import { sendEmail } from "@/services/email";
import { sendSms } from "@/services/sms";
import { sendWhatsAppTextMessage } from "@/services/whatsapp";
import { ENTERPRISE_BILLING_CONTEXT } from "./policy";
import {
  readState,
  event,
  cents,
  funds,
  decimal,
  clock,
  monthlyTariff,
  outstandingPeriods,
  planPayroll,
  type State,
  type Member,
  type Adjustment,
  type Payment,
} from "./store";
const id = z.number().int().positive().max(2147483647),
  month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  currency = z.string().regex(/^[A-Z]{3}$/),
  amount = z
    .string()
    .max(18)
    .refine((v) => {
      try {
        return cents(v) > BigInt(0);
      } catch {
        return false;
      }
    }, "Montant positif avec deux décimales maximum."),
  pin = z.string().regex(/^\d{4,6}$/);
const activation = z.object({
  companyName: z.string().trim().min(2).max(160),
  managerWallet: z.string().trim().max(40).optional(),
  monthlyCurrency: currency,
  acceptedMonthlyAmount: amount,
  pin,
  active: z.boolean().default(true),
});
const mutation = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("employee"),
    walletId: z.string().trim().min(6).max(40),
    salary: amount,
    currency,
    startMonth: month,
    active: z.boolean(),
    pin,
  }),
  z.object({
    action: z.literal("member"),
    walletId: z.string().trim().min(6).max(40),
    role: z.enum(["manager", "treasurer", "accountant", "cashier"]),
    active: z.boolean(),
    pin,
  }),
  z.object({
    action: z.literal("adjustment"),
    userId: id,
    amount,
    currency,
    month,
    reason: z.string().trim().min(5).max(1000),
    pin,
  }),
  z.object({
    action: z.literal("review"),
    key: z.string().uuid(),
    decision: z.enum(["approved", "disputed", "rejected"]),
    reason: z.string().trim().min(5).max(1000),
    pin,
  }),
]);
export const selection = z.object({
  companyId: id,
  userIds: z.array(id).min(1).max(200),
  months: z.array(month).min(1).max(12),
  currency,
});
async function transaction<T>(fn: (c: PoolClient) => Promise<T>) {
  const c = await db.getConnection();
  try {
    await c.query("BEGIN");
    const value = await fn(c);
    await c.query("COMMIT");
    return value;
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}
async function lock(c: PoolClient, companyId: number) {
  await c.query("SELECT pg_advisory_xact_lock(437021,$1)", [companyId]);
}
async function user(c: EnterpriseDb, userId: number) {
  const row = (
    await c.query(
      "SELECT id,full_name,first_name,id_wallet,account_type,role,status,country,email,phone,pin_hash,notifications_channel FROM users WHERE id=$1",
      [userId],
    )
  ).rows[0];
  if (!row || String(row.status).toLowerCase() !== "active")
    throw Error("Compte actif requis.");
  return row;
}
const pinAttempts = new Map<number, { count: number; until: number }>();
async function verifyPin(c: PoolClient, actorId: number, value: string) {
  const now = Date.now();
  for (const [key, entry] of pinAttempts)
    if (entry.until <= now) pinAttempts.delete(key);
  const old = pinAttempts.get(actorId);
  if (old && old.count >= 5)
    throw Error("Trop de tentatives PIN. Réessayez dans quinze minutes.");
  pinAttempts.set(actorId, {
    count: (old?.count || 0) + 1,
    until: old?.until || now + 900000,
  });
  const actor = await user(c, actorId);
  if (!actor.pin_hash || !(await bcrypt.compare(value, actor.pin_hash)))
    throw Error("PIN incorrect.");
  pinAttempts.delete(actorId);
  return actor;
}
function permission(state: State, actorId: number, companyId: number) {
  if (!state.config?.active) throw Error("Mode entreprise inactif.");
  if (actorId === companyId || actorId === state.config.managerId)
    return "manager";
  const member = state.members[String(actorId)];
  if (!member?.active) throw Error("Accès entreprise refusé.");
  return member.role;
}
async function context(c: PoolClient, actorId: number, companyId: number) {
  const actor = await user(c, actorId),
    company = await user(c, companyId),
    state = await readState(c, companyId);
  if (company.account_type !== "business")
    throw Error("Type entreprise requis.");
  return { actor, company, state, role: permission(state, actorId, companyId) };
}
function requireManager(role: string) {
  if (role !== "manager") throw Error("Validation du gérant requise.");
}
async function notice(
  c: PoolClient,
  userId: number,
  title: string,
  message: string,
) {
  await c.query(
    "INSERT INTO notifications(user_id,title,description,type,link,is_read) VALUES($1,$2,$3,'general','/enterprise',FALSE)",
    [userId, title, message],
  );
}
function escapeHtml(value: string) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
async function contact(person: any, subject: string, message: string) {
  const channels =
    typeof person.notifications_channel === "string"
      ? JSON.parse(person.notifications_channel)
      : person.notifications_channel || [];
  const tasks: Promise<unknown>[] = [];
  if (channels.includes("email") && person.email)
    tasks.push(
      sendEmail(person.email, subject, "enterprise", {
        message: escapeHtml(message),
        title: escapeHtml(subject),
        greeting: escapeHtml(
          `Bonjour ${person.first_name || person.full_name},`,
        ),
        intro: escapeHtml(message),
        otpCode: "",
        warning: "Consultez votre historique CashPay pour le détail.",
        signature: "CashPay All",
        loginTime: "",
        deviceType: "",
        operatingSystem: "",
        browser: "",
        ipAddress: "",
        location: "",
      }),
    );
  if (channels.includes("sms") && person.phone)
    tasks.push(sendSms(person.phone, message));
  if (channels.includes("whatsapp") && person.phone)
    tasks.push(sendWhatsAppTextMessage(person.phone, message));
  const results = await Promise.allSettled(tasks);
  if (
    results.some(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && (r.value as any)?.success === false),
    )
  )
    console.error("[enterprise] Notification externe non confirmée.");
}
export async function activateEnterprise(
  actorId: number,
  companyId: number,
  raw: unknown,
) {
  const data = activation.parse(raw);
  let recipient: any;
  let activationAmount = "";
  await transaction(async (c) => {
    await assertManagedUser(actorId, companyId, c);
    await verifyPin(c, actorId, data.pin);
    await lock(c, companyId);
    const company = await user(c, companyId);
    if (!["Client", "PartnerB2B"].includes(company.role))
      throw Error("Le compte cible doit être un compte client ou partenaire.");
    const old = await readState(c, companyId);
    const now = await clock(c);
    const tariff = await monthlyTariff(
      c,
      data.monthlyCurrency,
      countryToCode(company.country) || "GBL",
    );
    activationAmount = tariff;
    if (cents(tariff) !== cents(data.acceptedMonthlyAmount))
      throw Error(
        "Le forfait a changé. Consultez le tarif et confirmez de nouveau.",
      );
    let managerId = companyId;
    if (data.managerWallet) {
      const manager = (
        await c.query(
          "SELECT id FROM users WHERE id_wallet=$1 AND LOWER(status::text)='active'",
          [data.managerWallet],
        )
      ).rows[0];
      if (!manager) throw Error("Wallet du gérant introuvable.");
      managerId = Number(manager.id);
    }
    if (old.config && old.config.monthlyCurrency !== data.monthlyCurrency)
      throw Error(
        "La devise du forfait ne peut pas être modifiée après activation.",
      );
    await c.query(
      "UPDATE users SET account_type='business',full_name=$2 WHERE id=$1",
      [companyId, data.companyName],
    );
    await event(c, actorId, companyId, "ENTERPRISE_CONFIG", {
      key: "config",
      active: data.active,
      managerId,
      monthlyCurrency: data.monthlyCurrency,
      billingFrom: old.config?.billingFrom || now.month,
      companyName: data.companyName,
      activationMonthlyAmount: tariff,
    });
    await notice(
      c,
      companyId,
      "Compte entreprise CashPay",
      `Le mode entreprise de ${data.companyName} a été ${data.active ? "activé" : "suspendu"}. Forfait mensuel : ${tariff} ${data.monthlyCurrency}.`,
    );
    recipient = company;
  });
  void contact(
    recipient,
    "Compte entreprise CashPay",
    `Le mode entreprise de ${data.companyName} a été ${data.active ? "activé" : "suspendu"}. Forfait mensuel : ${activationAmount} ${data.monthlyCurrency}.`,
  ).catch(() => {});
  return { success: true };
}
export async function listEnterprises(actorId: number) {
  await user(db, actorId);
  const { rows } = await db.query(
    "SELECT DISTINCT target_user_id FROM super_agent_interventions WHERE action_type=ANY($1::text[]) AND (target_user_id=$2 OR detail::jsonb->>'userId'=$3 OR detail::jsonb->>'managerId'=$3)",
    [["ENTERPRISE_CONFIG", "ENTERPRISE_MEMBER"], actorId, String(actorId)],
  );
  const list = [];
  for (const row of rows) {
    const companyId = Number(row.target_user_id),
      state = await readState(db, companyId);
    try {
      const role = permission(state, actorId, companyId);
      const company = await user(db, companyId);
      if (company.account_type === "business")
        list.push({
          id: companyId,
          name: company.full_name,
          walletId: company.id_wallet,
          role,
        });
    } catch {}
  }
  return list;
}
export async function enterpriseDashboard(actorId: number, companyId: number) {
  return transaction(async (c) => {
    await lock(c, companyId);
    const { company, state, role } = await context(c, actorId, companyId);
    const time = await clock(c),
      balance =
        (
          await c.query("SELECT balances FROM wallets WHERE user_id=$1", [
            companyId,
          ])
        ).rows[0]?.balances || {};
    const applied: Record<string, bigint> = {};
    for (const payment of state.payments)
      for (const line of payment.lines)
        for (const allocation of line.allocations)
          applied[allocation.key] =
            (applied[allocation.key] || BigInt(0)) + cents(allocation.amount);
    return {
      success: true,
      company: {
        id: companyId,
        name: company.full_name,
        walletId: company.id_wallet,
      },
      role,
      revision: state.revision,
      employees: Object.values(state.employees).map((employee) => ({
        ...employee,
        paidMonths: [
          ...new Set(
            state.payments.flatMap((p) =>
              p.lines
                .filter((l) => l.userId === employee.userId)
                .flatMap((l) => l.months),
            ),
          ),
        ],
      })),
      members: Object.values(state.members),
      adjustments: Object.values(state.adjustments).map((adjustment) => ({
        ...adjustment,
        applied: decimal(applied[adjustment.key] || BigInt(0)),
        remaining: decimal(
          cents(adjustment.amount) - (applied[adjustment.key] || BigInt(0)),
        ),
      })),
      payments: state.payments.slice(-50).reverse(),
      bills: Object.values(state.bills),
      balance: typeof balance === "string" ? JSON.parse(balance) : balance,
      month: time.month,
      dueMonths: outstandingPeriods(state, time.due_through),
      monthlyCurrency: state.config!.monthlyCurrency,
      monthlyAmount: await monthlyTariff(
        c,
        state.config!.monthlyCurrency,
        countryToCode(company.country) || "GBL",
      ),
    };
  });
}
export async function mutateEnterprise(
  actorId: number,
  companyId: number,
  raw: unknown,
) {
  const data = mutation.parse(raw);
  return transaction(async (c) => {
    await lock(c, companyId);
    const { state, role } = await context(c, actorId, companyId);
    await verifyPin(c, actorId, data.pin);
    const now = await clock(c);
    if (data.action === "employee" || data.action === "member") {
      requireManager(role);
      const target = (
        await c.query(
          "SELECT id,full_name,id_wallet,account_type FROM users WHERE id_wallet=$1 AND LOWER(status::text)='active'",
          [data.walletId],
        )
      ).rows[0];
      if (!target || Number(target.id) === companyId)
        throw Error("Compte CashPay personnel actif du travailleur requis.");
      const key = String(target.id);
      if (data.action === "employee") {
        if (target.account_type === "business")
          throw Error("Le salarié doit posséder un compte personnel.");
        if (data.startMonth > now.month)
          throw Error("Mois d’entrée futur interdit.");
        const old = state.employees[key];
        if (
          old &&
          old.currency !== data.currency &&
          Object.values(state.adjustments).some(
            (a) => a.userId === Number(target.id) && a.status === "approved",
          )
        )
          throw Error("Régularisez les avances avant de changer la devise.");
        await event(c, actorId, companyId, "ENTERPRISE_EMPLOYEE", {
          key,
          userId: Number(target.id),
          walletId: target.id_wallet,
          name: target.full_name,
          salary: decimal(cents(data.salary)),
          currency: data.currency,
          startMonth: data.startMonth,
          active: data.active,
        });
      } else {
        if (Number(target.id) === state.config!.managerId)
          throw Error(
            "Le gérant principal doit être modifié par l’administrateur.",
          );
        await event(c, actorId, companyId, "ENTERPRISE_MEMBER", {
          key,
          userId: Number(target.id),
          walletId: target.id_wallet,
          name: target.full_name,
          role: data.role,
          active: data.active,
        } satisfies Member);
      }
    } else if (data.action === "adjustment") {
      const employee = state.employees[String(data.userId)];
      if (
        !employee?.active ||
        employee.currency !== data.currency ||
        data.month > now.month
      )
        throw Error("Salarié, devise ou mois invalide.");
      await event(c, actorId, companyId, "ENTERPRISE_ADJUST", {
        key: crypto.randomUUID(),
        userId: data.userId,
        amount: decimal(cents(data.amount)),
        currency: data.currency,
        month: data.month,
        reason: data.reason,
        status: "pending",
        createdBy: actorId,
      } satisfies Adjustment);
    } else {
      requireManager(role);
      const old = state.adjustments[data.key];
      if (!old) throw Error("Retenue introuvable.");
      if (
        state.payments.some((p) =>
          p.lines.some((l) => l.allocations.some((a) => a.key === data.key)),
        )
      )
        throw Error("Une retenue déjà imputée ne peut plus être modifiée.");
      await event(c, actorId, companyId, "ENTERPRISE_ADJUST", {
        ...old,
        status: data.decision,
        approvedBy: actorId,
        reviewReason: data.reason,
      });
    }
    return { success: true };
  });
}
async function quote(
  c: PoolClient,
  actorId: number,
  input: z.infer<typeof selection>,
  locked = false,
) {
  const { company, state, role } = await context(c, actorId, input.companyId);
  const now = await clock(c);
  await monthlyTariff(
    c,
    state.config!.monthlyCurrency,
    countryToCode(company.country) || "GBL",
  );
  if (outstandingPeriods(state, now.due_through).length)
    throw Error("Forfait mensuel impayé : régularisez avant la paie.");
  const lines = planPayroll(
    state,
    input.userIds,
    input.months,
    input.currency,
    now.month,
  );
  for (const line of lines) {
    const worker = await user(c, line.userId);
    if (worker.account_type === "business")
      throw Error(
        "Un compte salarié est devenu un compte entreprise. Mettez à jour la fiche.",
      );
    if (worker.id_wallet !== line.walletId)
      throw Error(
        "Coordonnées du travailleur modifiées : mettez à jour sa fiche.",
      );
  }
  const wallets = (
    await c.query(
      `SELECT user_id,balances FROM wallets WHERE user_id=ANY($1::int[]) ORDER BY user_id ${locked ? "FOR UPDATE" : ""}`,
      [[input.companyId, ...input.userIds]],
    )
  ).rows;
  if (wallets.length !== input.userIds.length + 1)
    throw Error("Un portefeuille est indisponible.");
  const balances = wallets.find(
    (w) => Number(w.user_id) === input.companyId,
  ).balances;
  const parsed = typeof balances === "string" ? JSON.parse(balances) : balances;
  const available = funds(parsed[input.currency] || 0);
  const total = lines.reduce((sum, line) => sum + cents(line.net), BigInt(0));
  if (total > BigInt("100000000000000"))
    throw Error("Montant du lot hors limite de précision.");
  const digest = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        companyId: input.companyId,
        revision: state.revision,
        currency: input.currency,
        lines,
      }),
    )
    .digest("hex");
  return {
    company,
    state,
    role,
    lines,
    total: decimal(total),
    balance: decimal(available),
    sufficient: available >= total,
    digest,
  };
}
export async function previewPayroll(actorId: number, raw: unknown) {
  const input = selection.parse(raw);
  return transaction(async (c) => {
    await lock(c, input.companyId);
    const result = await quote(c, actorId, input);
    return {
      success: true,
      lines: result.lines,
      total: result.total,
      balance: result.balance,
      sufficient: result.sufficient,
      digest: result.digest,
    };
  });
}
export async function executePayroll(actorId: number, raw: unknown) {
  const input = selection
    .extend({
      pin,
      digest: z.string().regex(/^[a-f0-9]{64}$/),
      requestKey: z.string().uuid(),
    })
    .parse(raw);
  const contacts: any[] = [];
  const result = await transaction(async (c) => {
    await lock(c, input.companyId);
    const current = await context(c, actorId, input.companyId);
    if (!["manager", "treasurer"].includes(current.role))
      throw Error("Gérant ou trésorier requis pour payer.");
    await verifyPin(c, actorId, input.pin);
    const old = current.state.payments.find((p) => p.key === input.requestKey);
    if (old) {
      if (
        old.currency !== input.currency ||
        JSON.stringify(old.lines.map((l) => l.userId).sort((a, b) => a - b)) !==
          JSON.stringify([...input.userIds].sort((a, b) => a - b)) ||
        JSON.stringify([...old.periods].sort()) !==
          JSON.stringify([...input.months].sort())
      )
        throw Error("Clé de paiement déjà utilisée avec une autre sélection.");
      return { success: true, payment: old, replayed: true };
    }
    const q = await quote(c, actorId, input, true);
    if (q.digest !== input.digest)
      throw Error(
        "Les données ont changé. Recalculez la paie avant de confirmer.",
      );
    if (!q.sufficient)
      throw Error(
        `Solde insuffisant : ${q.total} ${input.currency} requis, ${q.balance} disponibles.`,
      );
    const reference = crypto.randomUUID();
    for (const line of q.lines) {
      const recipient = await user(c, line.userId);
      let tx: any = { reference: `${reference}:${line.userId}` };
      if (cents(line.net) > BigInt(0)) {
        tx = await createTransaction({
          user: q.company,
          typeCode: "TR",
          amount: Number(line.net),
          currency: input.currency,
          receiver_id: line.userId,
          receiver_wallet_id: line.walletId,
          description: `Salaire ${q.company.full_name} — ${line.months.join(", ")}`,
          metadata: {
            enterprisePayroll: true,
            companyId: input.companyId,
            months: line.months,
            gross: line.gross,
            deduction: line.deduction,
            requestKey: input.requestKey,
          },
          referenceCode: `EP-${reference}-${line.userId}`,
          connection: c,
          enterpriseBillingContext: ENTERPRISE_BILLING_CONTEXT,
        });
        if (!tx.success) throw Error(tx.error || "Paiement refusé.");
        if (Number(tx.fee) !== 0)
          throw Error("Le mode sans frais entreprise n’est pas disponible.");
      }
      const message = `Bonjour ${recipient.first_name || recipient.full_name}, ${q.company.full_name} vous a réglé ${line.net} ${input.currency} pour ${line.months.join(", ")}. Brut : ${line.gross}. Retenues validées : ${line.deduction}. Référence : ${tx.reference}.`;
      await notice(c, line.userId, `Salaire — ${q.company.full_name}`, message);
      contacts.push({ recipient, message });
    }
    const payment: Payment = {
      key: input.requestKey,
      currency: input.currency,
      periods: [...input.months].sort(),
      lines: q.lines,
      reference,
      actorId,
    };
    await event(c, actorId, input.companyId, "ENTERPRISE_PAID", payment);
    await notice(
      c,
      input.companyId,
      "Paie groupée confirmée",
      `${q.lines.length} salariés, ${q.total} ${input.currency}. Référence ${reference}.`,
    );
    return { success: true, payment, replayed: false };
  });
  for (const n of contacts)
    void contact(
      n.recipient,
      `Salaire ${result.payment.periods.join(", ")}`,
      n.message,
    ).catch(() => {});
  return result;
}
export async function billEnterprises(companyId?: number) {
  const { rows } = await db.query(
    "SELECT DISTINCT target_user_id FROM super_agent_interventions WHERE action_type='ENTERPRISE_CONFIG' AND ($1::integer IS NULL OR target_user_id=$1)",
    [companyId || null],
  );
  let processed = 0,
    failed = 0;
  for (const row of rows) {
    try {
      processed += await transaction(async (c) => {
        const id = Number(row.target_user_id);
        await lock(c, id);
        const company = await user(c, id),
          state = await readState(c, id);
        if (!state.config?.active || company.account_type !== "business")
          return 0;
        const now = await clock(c),
          due = outstandingPeriods(state, now.due_through);
        let count = 0;
        for (const period of due) {
          const bill = state.bills[period] || {
            key: period,
            currency: state.config.monthlyCurrency,
            amount: await monthlyTariff(
              c,
              state.config.monthlyCurrency,
              countryToCode(company.country) || "GBL",
            ),
            status: "pending" as const,
          };
          const wallet = (
            await c.query(
              "SELECT balances FROM wallets WHERE user_id=$1 FOR UPDATE",
              [id],
            )
          ).rows[0];
          if (!wallet) throw Error("Portefeuille entreprise absent.");
          const balances =
            typeof wallet.balances === "string"
              ? JSON.parse(wallet.balances)
              : wallet.balances;
          if (funds(balances[bill.currency] || 0) < cents(bill.amount)) {
            if (!state.bills[period]) {
              await event(c, id, id, "ENTERPRISE_BILL", bill);
              await notice(
                c,
                id,
                "Forfait entreprise en attente",
                `${bill.amount} ${bill.currency} dus pour ${period}. Approvisionnez votre portefeuille.`,
              );
            }
            break;
          }
          const tx = await createTransaction({
            user: company,
            typeCode: "MKTG_FEE",
            amount: Number(bill.amount),
            currency: bill.currency,
            description: `Forfait entreprise ${period}`,
            metadata: { enterpriseMonthly: true, month: period },
            referenceCode: `EM-${id}-${period}`,
            connection: c,
            enterpriseBillingContext: ENTERPRISE_BILLING_CONTEXT,
          });
          if (!tx.success) throw Error(tx.error || "Forfait non prélevé.");
          await event(c, id, id, "ENTERPRISE_BILL", {
            ...bill,
            status: "paid",
            reference: tx.reference,
          });
          await notice(
            c,
            id,
            "Forfait entreprise prélevé",
            `${bill.amount} ${bill.currency} pour ${period}. Référence ${tx.reference}.`,
          );
          count++;
        }
        return count;
      });
    } catch {
      failed++;
      console.error("[enterprise-billing] Dossier non traité", {
        companyId: row.target_user_id,
      });
    }
  }
  return { success: failed === 0, processed, failed };
}

export async function activationQuote(
  actorId: number,
  companyId: number,
  currency: string,
) {
  if (!/^[A-Z]{3}$/.test(currency)) throw Error("Devise invalide.");
  return transaction(async (c) => {
    await assertManagedUser(actorId, companyId, c);
    const company = await user(c, companyId),
      state = await readState(c, companyId);
    return {
      success: true,
      companyName: company.full_name,
      monthlyAmount: await monthlyTariff(
        c,
        currency,
        countryToCode(company.country) || "GBL",
      ),
      monthlyCurrency: currency,
      active: state.config?.active || false,
    };
  });
}

export async function findPayroll(
  actorId: number,
  companyId: number,
  key: string,
) {
  z.string().uuid().parse(key);
  return transaction(async (c) => {
    await lock(c, companyId);
    const { state } = await context(c, actorId, companyId);
    return {
      success: true,
      payment: state.payments.find((payment) => payment.key === key) || null,
    };
  });
}
