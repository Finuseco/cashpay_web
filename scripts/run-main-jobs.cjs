'use strict';
// Run from cron in the Web checkout; the secret stays in the existing env files.
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(path.resolve(__dirname, '..'), false);
(async () => {
  const secret = process.env.INTERNAL_JOB_SECRET;
  if (!secret || secret.length < 32) throw new Error('Configure INTERNAL_JOB_SECRET (32+ characters).');
  const response = await fetch('https://app.cashpay-all.com/api/main/internal/dispatch', {
    method: 'POST', headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(115000), redirect: 'error'
  });
  if (!response.ok) throw new Error(`Main jobs returned HTTP ${response.status}.`);
  const result = await response.json();
  console.log(JSON.stringify({ ok: result.ok === true, checkedAt: new Date().toISOString() }));
})().catch(error => { console.error(error.message.startsWith('Main jobs') || error.message.startsWith('Configure ') ? error.message : 'Main jobs unavailable.'); process.exitCode = 1; });
