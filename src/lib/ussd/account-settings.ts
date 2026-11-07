import { db } from "@/lib/db";
import { verifyUserPin } from "@/lib/actions/auth.actions";
import { calculateTransactionFee } from "@/lib/actions/wallet.actions";
import { createTransaction } from "@/lib/actions/transaction.actions";
import { formatUser } from "@/lib/utils";
import type { User } from "@/lib/types";
import * as bcrypt from "bcryptjs";
import crypto from "crypto";
const stamp = (hash: string) =>
  crypto.createHash("sha256").update(hash).digest("hex");
const attempts = new Map<number, { count: number; until: number }>();
async function checkedPin(user: User, value: string) {
  const now = Date.now();
  for (const [id, item] of attempts) if (item.until <= now) attempts.delete(id);
  const previous = attempts.get(user.id);
  if (previous && previous.count >= 5)
    throw Error("Trop de PIN incorrects. Réessayez dans 15 minutes.");
  const result = await verifyUserPin(user.id, value);
  if (!result.success) {
    const state = previous || { count: 0, until: now + 15 * 60000 };
    state.count++;
    attempts.set(user.id, state);
    throw Error(result.error || "Code PIN incorrect.");
  }
  attempts.delete(user.id);
}
export async function beginPinChange(user: User, current: string) {
  await checkedPin(user, current);
  const { rows } = await db.query("SELECT pin_hash FROM users WHERE id=$1", [
    user.id,
  ]);
  return stamp(rows[0].pin_hash);
}
export async function preparePin(newPin: string) {
  if (!/^\d{4}$/.test(newPin))
    throw Error("Le PIN doit contenir quatre chiffres.");
  return bcrypt.hash(newPin, 12);
}
export async function finishPinChange(
  user: User,
  oldStamp: string,
  newHash: string,
  confirmation: string,
) {
  if (
    !/^\d{4}$/.test(confirmation) ||
    !/^\$2[aby]\$/.test(newHash || "") ||
    !(await bcrypt.compare(confirmation, newHash))
  )
    throw Error("Les codes PIN ne correspondent pas.");
  const c = await db.getConnection();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query(
      "SELECT pin_hash,status FROM users WHERE id=$1 FOR UPDATE",
      [user.id],
    );
    if (
      !rows[0] ||
      String(rows[0].status).toLowerCase() !== "active" ||
      stamp(rows[0].pin_hash) !== oldStamp
    )
      throw Error("Le compte ou le PIN a changé. Recommencez.");
    if (await bcrypt.compare(confirmation, rows[0].pin_hash))
      throw Error("Choisissez un nouveau PIN différent.");
    await c.query("UPDATE users SET pin_hash=$2 WHERE id=$1", [
      user.id,
      newHash,
    ]);
    await c.query(
      "INSERT INTO notifications(user_id,title,description,type,link,is_read) VALUES($1,'PIN CashPay modifié','Votre code PIN a été modifié depuis USSD. Si vous n’en êtes pas à l’origine, contactez immédiatement le support.','general',NULL,FALSE)",
      [user.id],
    );
    await c.query("COMMIT");
    return { success: true };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function agentOffers(user: User) {
  const offers = [];
  for (const plan of ["promo", "normal"] as const) {
    try {
      const fee = Number(
        await calculateTransactionFee(
          1,
          "USD",
          plan === "promo" ? "AGENT_SUB_PROMO" : "AGENT_SUB_NORMAL",
          user.country,
        ),
      );
      if (Number.isFinite(fee) && fee > 0)
        offers.push({ plan, fee, currency: "USD", days: 30 });
    } catch {}
  }
  return offers;
}
export async function activateAgent(
  user: User,
  pin: string,
  accepted: { plan: string; fee: number; currency: string },
) {
  if (
    !accepted ||
    !["promo", "normal"].includes(accepted.plan) ||
    accepted.currency !== "USD" ||
    !Number.isFinite(accepted.fee) ||
    accepted.fee <= 0
  )
    throw Error("Chargez et confirmez le forfait Agent.");
  await checkedPin(user, pin);
  const c = await db.getConnection();
  try {
    await c.query("BEGIN");
    const row = (
      await c.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [user.id])
    ).rows[0];
    if (
      !row ||
      !["Client", "Agent"].includes(row.role) ||
      String(row.status).toLowerCase() !== "active"
    )
      throw Error("Compte Client ou Agent actif requis.");
    const subscription = (
      await c.query(
        "SELECT status,current_period_end FROM agent_subscriptions WHERE user_id=$1 FOR UPDATE",
        [user.id],
      )
    ).rows[0];
    if (
      subscription?.status === "active" &&
      new Date(subscription.current_period_end).getTime() > Date.now()
    )
      throw Error("Abonnement déjà actif. Aucun nouveau débit.");
    const fee = Number(
      await calculateTransactionFee(
        1,
        "USD",
        accepted.plan === "promo" ? "AGENT_SUB_PROMO" : "AGENT_SUB_NORMAL",
        row.country,
        c,
      ),
    );
    if (!Number.isFinite(fee) || fee <= 0 || fee !== accepted.fee)
      throw Error("Le tarif a changé. Rechargez et confirmez le forfait.");
    if (!(await bcrypt.compare(pin, row.pin_hash)))
      throw Error("Le PIN a changé. Recommencez.");
    const tx = await createTransaction({
      user: formatUser(row),
      typeCode: "AGENT_SUB",
      amount: fee,
      currency: "USD",
      description: `Abonnement Agent ${accepted.plan} - 30 jours`,
      metadata: {
        channel: "USSD",
        plan: accepted.plan,
        action: "initial_subscription",
      },
      connection: c,
    });
    if (!tx.success) throw Error(tx.error || "Paiement refusé.");
    await c.query(
      "INSERT INTO agent_subscriptions(user_id,status,current_period_end,is_promo_period,auto_renew) VALUES($1,'active',NOW()+INTERVAL '30 days',$2,FALSE) ON CONFLICT(user_id) DO UPDATE SET status='active',current_period_end=EXCLUDED.current_period_end,is_promo_period=EXCLUDED.is_promo_period,updated_at=NOW()",
      [user.id, accepted.plan === "promo"],
    );
    await c.query("UPDATE users SET role='Agent' WHERE id=$1", [user.id]);
    await c.query(
      "INSERT INTO notifications(user_id,title,description,type,link,is_read) VALUES($1,'Abonnement Agent activé',$2,'general',NULL,FALSE)",
      [user.id, `Forfait ${accepted.plan} : ${fee} USD, valable 30 jours.`],
    );
    await c.query("COMMIT");
    return { success: true, fee };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
