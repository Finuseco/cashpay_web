const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");
const { Client } = require("pg");
const root = path.resolve(__dirname, "../..");
for (const file of [".env.production", ".env"]) {
  const target = path.join(root, file);
  if (fs.existsSync(target))
    for (const [key, value] of Object.entries(
      parseEnv(fs.readFileSync(target, "utf8")),
    ))
      if (process.env[key] === undefined) process.env[key] = value;
}
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
const url = new URL("/api/internal/jobs/loan-repayments", base);
let active = false,
  pending = false,
  stopping = false,
  client = null,
  reconnect,
  timer;
async function run() {
  if (stopping) return;
  if (active) {
    pending = true;
    return;
  }
  active = true;
  try {
    const response = await fetch(url, {
      headers: { "x-internal-job-secret": secret },
      redirect: "error",
      signal: AbortSignal.timeout(55000),
    });
    const data = await response.json();
    if (!response.ok || data.success !== true)
      console.error("[loan-worker] Traitement incomplet", {
        status: response.status,
        failed: data.failed || 0,
      });
    else
      console.log("[loan-worker] Vérification terminée", {
        processed: data.processed || 0,
        events: data.events || 0,
      });
  } catch (error) {
    console.error("[loan-worker] Backend indisponible", error.name);
  } finally {
    active = false;
    if (pending && !stopping) {
      pending = false;
      setTimeout(() => void run(), 1000);
    }
  }
}
async function listen() {
  if (stopping) return;
  const connection = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ...(process.env.DB_SSL_CA
      ? { ssl: { ca: process.env.DB_SSL_CA, rejectUnauthorized: true } }
      : {}),
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
      "[loan-worker] Connexion aux signaux interrompue ; reprise programmée.",
    );
    retry();
  });
  connection.on("end", retry);
  try {
    await connection.connect();
    client = connection;
    const schema = await connection.query(
      "SELECT to_regclass('loan_repayment_queue') AS queue",
    );
    if (!schema.rows[0].queue)
      throw Error("Installez migrations/20261106_loan_repayment_queue.sql.");
    await connection.query("LISTEN loan_repayment_requested");
    connection.on("notification", () => void run());
    console.log("[loan-worker] Écoute des crédits active.");
    void run();
  } catch (error) {
    console.error(
      "[loan-worker] Écoute indisponible",
      error.message?.startsWith("Installez migrations/")
        ? error.message
        : error.code || "schema_or_connection",
    );
    retry();
  }
}
timer = setInterval(() => void run(), 60000);
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
