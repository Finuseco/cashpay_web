const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function loadEnvironment() {
  require('@next/env').loadEnvConfig(root, false);
}
function databaseConfig() {
  return {
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10000, keepAlive: true,
    ...(process.env.DB_SSL_CA ? {ssl:{ca:process.env.DB_SSL_CA,rejectUnauthorized:true}} : {}),
  };
}
async function checkSchema(client) {
  const { rows } = await client.query(`SELECT
    to_regclass('loan_repayment_queue') IS NOT NULL AS queue,
    to_regclass('loan_installments') IS NOT NULL AS installments,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('wallets') AND tgname='cashpay_loan_credit_requested' AND tgenabled IN ('O','A') AND NOT tgisinternal) AS trigger`);
  const missing = Object.entries(rows[0]).filter(([,ready])=>!ready).map(([name])=>name);
  if(missing.length) throw Object.assign(new Error('Loan repayment setup incomplete'),{code:'LOAN_SETUP_REQUIRED',missing});
}
module.exports = { root, loadEnvironment, databaseConfig, checkSchema };
