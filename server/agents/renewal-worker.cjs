const { Client } = require("pg");
const {
  loadEnvironment,
  databaseConfig,
} = require("../loans/runtime-config.cjs");
loadEnvironment();
const secret = process.env.INTERNAL_JOB_SECRET;
if (!secret)
  throw Error("INTERNAL_JOB_SECRET requis, identique au backend Wallet.");
const base = new URL(process.env.CASH_PAY_APP_URL || "http://127.0.0.1:8002");
if (
  base.username ||
  base.password ||
  base.pathname !== "/" ||
  base.search ||
  base.hash ||
  !(
    base.protocol === "https:" ||
    (base.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))
  )
)
  throw Error("CASH_PAY_APP_URL doit être une origine HTTPS ou loopback.");
const url = new URL("/api/internal/jobs/agent-renewals", base);
const pendingUsers = new Set();
let sweepRequested = true;
let active = false,
  pending = false,
  stopping = false,
  client = null,
  reconnect,
  timer;
async function run() {
  if (stopping || (!sweepRequested && pendingUsers.size === 0)) return;
  if (active) {
    pending = true;
    return;
  }
  active = true;
  const userId = pendingUsers.values().next().value;
  if (userId === undefined) sweepRequested = false;
  if (userId !== undefined) pendingUsers.delete(userId);
  const target = new URL(url);
  if (userId !== undefined) target.searchParams.set("userId", String(userId));
  let outcome = "error";
  try {
    const response = await fetch(target, {
      headers: { "x-internal-job-secret": secret },
      redirect: "error",
      signal: AbortSignal.timeout(55000),
    });
    const data = await response.json();
    if (!response.ok || data.success !== true)
      console.error("[agent-renewals] Traitement incomplet", {
        status: response.status,
        failed: data.failed || 0,
      });
    else {
      outcome = "ok";
      console.log("[agent-renewals] Vérification des abonnements terminée", {
        renewed: data.renewed || 0,
        pending: data.failed || 0,
      });
    }
  } catch (error) {
    console.error("[agent-renewals] Backend indisponible", error.name);
  } finally {
    if (client)
      await client
        .query("SELECT set_config('application_name',$1,false)", [
          `cashpay-agent-renewals:${outcome}:${Date.now()}`,
        ])
        .catch(() => {});
    active = false;
    if ((pending || pendingUsers.size || sweepRequested) && !stopping) {
      pending = false;
      setTimeout(() => void run(), 1000);
    }
  }
}
async function listen() {
  if (stopping) return;
  const connection = new Client({
    ...databaseConfig(),
    query_timeout: 10000,
    statement_timeout: 10000,
    application_name: "cashpay-agent-renewals:starting",
  });
  let retrying = false;
  const retry = () => {
    if (retrying || stopping) return;
    retrying = true;
    void connection.end().catch(() => {});
    reconnect = setTimeout(() => void listen(), 15000);
  };
  connection.on("error", () => {
    console.error(
      "[agent-renewals] Connexion aux signaux interrompue ; reprise programmée.",
    );
    retry();
  });
  connection.on("end", retry);
  try {
    await connection.connect();
    client = connection;
    const ready = await connection.query(
      "SELECT to_regclass('super_agent_interventions') IS NOT NULL AS audit,to_regclass('fee_structures') IS NOT NULL AND to_regclass('agent_subscriptions') IS NOT NULL AS fees",
    );
    if (!ready.rows[0]?.audit || !ready.rows[0]?.fees)
      throw Object.assign(Error("Schéma abonnement agent incomplet"), {
        code: "AGENT_SUBSCRIPTIONS_SETUP_REQUIRED",
      });
    await connection.query("LISTEN loan_repayment_requested");
    connection.on("notification", (event) => {
      if (
        event.channel !== "loan_repayment_requested" ||
        !/^[1-9]\d*$/.test(event.payload || "")
      )
        return;
      const id = Number(event.payload);
      if (!Number.isSafeInteger(id)) return;
      pendingUsers.add(id);
      void run();
    });
    console.log(
      "[agent-renewals] Écoute des crédits pour renouvellement agent active.",
    );
    sweepRequested = true;
    void run();
  } catch (error) {
    console.error("[agent-renewals] Écoute indisponible", {
      code: error.code || "schema_or_connection",
      missing: error.missing || [],
    });
    retry();
  }
}
timer = setInterval(() => {
  sweepRequested = true;
  void run();
}, 60000);
void listen();
void run();
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  clearTimeout(reconnect);
  if (client) await client.end().catch(() => {});
  const deadline = Date.now() + 60000;
  while (active && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 100));
  process.exit(active ? 1 : 0);
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
