import type { EnterpriseDb } from "./store";
import { foldEvents, clock, outstandingPeriods, monthlyTariff } from "./store";
import { countryToCode } from "@/lib/utils";
export const ENTERPRISE_BILLING_CONTEXT = Symbol("enterprise-monthly-billing");
/** Authoritative DB identity only. Never accepts a client-supplied account type. */
export async function enterpriseFeeWaived(
  c: EnterpriseDb,
  userId: number,
  type: string,
) {
  if (type === "ENTERPRISE_MONTHLY" || type === "PRODUCT_SALE_VAT")
    return false;
  const { rows: users } = await c.query(
    "SELECT account_type,status,country FROM users WHERE id=$1",
    [userId],
  );
  if (
    users[0]?.account_type !== "business" ||
    String(users[0]?.status).toLowerCase() !== "active"
  )
    return false;
  const { rows } = await c.query(
    "SELECT id,action_type,detail FROM super_agent_interventions WHERE target_user_id=$1 AND action_type=ANY($2::text[]) ORDER BY id",
    [userId, ["ENTERPRISE_CONFIG", "ENTERPRISE_BILL"]],
  );
  const state = foldEvents(rows);
  if (!state.config?.active) return false;
  await monthlyTariff(
    c,
    state.config.monthlyCurrency,
    countryToCode(users[0].country) || "GBL",
  );
  const time = await clock(c);
  if (
    outstandingPeriods(state, time.due_through).length &&
    !["LR", "PENALTY", "LR_AGENT", "LRAC"].includes(type)
  )
    throw Error(
      "Forfait entreprise impayé : approvisionnez le portefeuille et attendez sa régularisation.",
    );
  return true;
}
