import { db } from "@/lib/db";
import { calculateTransactionFee } from "@/lib/actions/wallet.actions";
import { createTransaction } from "@/lib/actions/transaction.actions";
import { enterpriseFeeWaived } from "@/lib/enterprise/policy";
/** One attempt at expiry, then at most once per 48 hours. Shared row locks serialize manual renewal. */
export async function renewAgentSubscriptions() {
  const { rows } = await db.query(
    "SELECT s.user_id FROM agent_subscriptions s JOIN users u ON u.id=s.user_id WHERE s.auto_renew=TRUE AND s.status IN ('active','expired','inactive') AND s.current_period_end<=NOW() AND LOWER(u.status::text)='active' AND u.role IN ('Client','Agent','SubSuperAgent') AND NOT EXISTS(SELECT 1 FROM super_agent_interventions i WHERE i.target_user_id=s.user_id AND i.action_type='AGENT_RENEW_FAILED' AND i.created_at>NOW()-INTERVAL '48 hours') ORDER BY s.current_period_end LIMIT 500",
  );
  let renewed = 0,
    failed = 0,
    errors = 0;
  for (const row of rows) {
    const c = await db.getConnection();
    try {
      await c.query("BEGIN");
      const u = (
        await c.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [
          row.user_id,
        ])
      ).rows[0];
      const s = (
        await c.query(
          "SELECT *,current_period_end<=NOW() AS due FROM agent_subscriptions WHERE user_id=$1 FOR UPDATE",
          [row.user_id],
        )
      ).rows[0];
      if (
        !u ||
        String(u.status).toLowerCase() !== "active" ||
        !["Client", "Agent", "SubSuperAgent"].includes(u.role) ||
        !s?.auto_renew ||
        !s.due ||
        !["active", "expired", "inactive"].includes(s.status)
      ) {
        await c.query("ROLLBACK");
        continue;
      }
      const recent = await c.query(
        "SELECT 1 FROM super_agent_interventions WHERE target_user_id=$1 AND action_type='AGENT_RENEW_FAILED' AND created_at>NOW()-INTERVAL '48 hours' LIMIT 1",
        [u.id],
      );
      if (recent.rows.length) {
        await c.query("ROLLBACK");
        continue;
      }
      await c.query("SAVEPOINT renewal_charge");
      let failure = "";
      try {
        const fee = await calculateTransactionFee(
          1,
          "USD",
          "AGENT_SUB_NORMAL",
          u.country,
          c,
          u.id,
        );
        if (
          !Number.isFinite(fee) ||
          fee < 0 ||
          (fee === 0 &&
            !(await enterpriseFeeWaived(c, u.id, "AGENT_SUB_NORMAL")))
        )
          throw Error("Tarif non configuré.");
        const tx = await createTransaction({
          user: u,
          typeCode: "AGENT_SUB",
          amount: fee,
          currency: "USD",
          description: "Renouvellement automatique Agent — 30 jours",
          metadata: { method: "automatic", subscription_id: s.id },
          referenceCode: `ASR-${s.id}-${new Date(s.current_period_end).getTime()}`,
          connection: c,
        });
        if (!tx.success) throw Error(tx.error || "Prélèvement refusé.");
        await c.query(
          "UPDATE agent_subscriptions SET status='active',current_period_end=NOW()+INTERVAL '30 days',is_promo_period=FALSE,updated_at=NOW() WHERE user_id=$1",
          [u.id],
        );
        if (u.role === "Client")
          await c.query("UPDATE users SET role='Agent' WHERE id=$1", [u.id]);
        await c.query(
          "INSERT INTO notifications(user_id,title,description,type,link,is_read) VALUES($1,'Abonnement Agent renouvelé',$2,'general','/settings',FALSE)",
          [
            u.id,
            `Renouvellement de 30 jours confirmé : ${fee.toFixed(2)} USD. Référence ${tx.reference}.`,
          ],
        );
        await c.query(
          "INSERT INTO super_agent_interventions(admin_user_id,target_user_id,action_type,detail) VALUES($1,$1,'AGENT_RENEW_SUCCESS',$2)",
          [
            u.id,
            JSON.stringify({
              subscriptionId: s.id,
              reference: tx.reference,
              fee,
              currency: "USD",
            }),
          ],
        );
      } catch (error) {
        failure = "Prélèvement non confirmé. Vérifiez le solde et le tarif.";
        await c.query("ROLLBACK TO SAVEPOINT renewal_charge");
        await c.query(
          "UPDATE agent_subscriptions SET status='expired',updated_at=NOW() WHERE user_id=$1",
          [u.id],
        );
        await c.query(
          "INSERT INTO super_agent_interventions(admin_user_id,target_user_id,action_type,detail) VALUES($1,$1,'AGENT_RENEW_FAILED',$2)",
          [
            u.id,
            JSON.stringify({ subscriptionId: s.id, nextAttemptHours: 48 }),
          ],
        );
        await c.query(
          "INSERT INTO notifications(user_id,title,description,type,link,is_read) VALUES($1,'Renouvellement Agent en attente',$2,'general','/settings',FALSE)",
          [
            u.id,
            failure +
              " Nouvelle tentative dans 48 heures ; le renouvellement manuel reste disponible.",
          ],
        );
      }
      await c.query("COMMIT");
      if (failure) failed++;
      else renewed++;
    } catch {
      await c.query("ROLLBACK");
      failed++;
      errors++;
      console.error("[agent-renewal] Dossier non traité", {
        userId: row.user_id,
      });
    } finally {
      c.release();
    }
  }
  return { success: errors === 0, renewed, failed, errors };
}
