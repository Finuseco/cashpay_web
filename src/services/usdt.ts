// Logique serveur USDT (TRC-20) : adresses, dépôts, solde du registre CashPay.
// Module serveur uniquement : pas de 'use server', jamais importé côté client.

import { db } from '@/lib/db';
import { refundCryptoWithdrawal } from '@/lib/actions/crypto-refund';
import {
  USDT_TRC20_CONTRACT,
  deriveUserTronAddress,
  getTronHotWalletStatus,
  getTronTransactionOutcome,
  getTronUsdtRawBalance,
  getTrxBalanceSun,
  isBase58TronAddress,
  sendTrxFromHotWallet,
  sweepUsdtToHotWallet,
} from '@/services/tron';
import { planSweep } from '@/services/usdt-sweep-plan';

export const USDT_CURRENCY_CODE = 'USDT_TRC20';

interface Trc20Transfer {
  transaction_id?: string;
  to?: string;
  value?: string;
  type?: string;
}

/* -------------------------------------------------------------------------- */
/* Adresses                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Retourne l'adresse USDT TRC-20 de l'utilisateur, en la créant si besoin.
 * - Idempotent et protégé contre les appels simultanés (verrou par utilisateur).
 * - Remplace une ancienne adresse fictive ("USD_…") par une vraie adresse TRON.
 * - Lève UsdtNotConfiguredError si TRON_HD_MNEMONIC n'est pas configurée.
 */
export async function ensureUserUsdtAddress(
  userId: number,
): Promise<{ address: string; existing: boolean }> {
  const client = await db.getConnection();

  try {
    await client.query('BEGIN');

    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `usdt-address:${userId}`,
    ]);

    const found = await client.query(
      `SELECT address
       FROM user_crypto_addresses
       WHERE user_id = $1
         AND currency_code = $2
       LIMIT 1`,
      [userId, USDT_CURRENCY_CODE],
    );

    const current: string | undefined = found.rows[0]?.address;

    if (current && isBase58TronAddress(current)) {
      await client.query('COMMIT');
      return { address: current, existing: true };
    }

    // Lève UsdtNotConfiguredError si la conservation des clés est absente.
    const address = deriveUserTronAddress(userId);

    if (current) {
      // Ancienne valeur fictive (jamais utilisable pour recevoir) : on la remplace.
      await client.query(
        `UPDATE user_crypto_addresses
         SET address = $1
         WHERE user_id = $2
           AND currency_code = $3`,
        [address, userId, USDT_CURRENCY_CODE],
      );
    } else {
      await client.query(
        `INSERT INTO user_crypto_addresses (user_id, currency_code, address)
         VALUES ($1, $2, $3)`,
        [userId, USDT_CURRENCY_CODE, address],
      );
    }

    await client.query(
      `INSERT INTO user_crypto_balances (user_id, currency_code, balance)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, currency_code) DO NOTHING`,
      [userId, USDT_CURRENCY_CODE],
    );

    await client.query('COMMIT');

    return { address, existing: false };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[USDT] Échec du rollback (adresse) :', rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}

/** Adresse USDT déjà attribuée (et valide) à l'utilisateur, sinon null. */
export async function getUserUsdtAddress(
  userId: number,
): Promise<string | null> {
  const result = await db.query(
    `SELECT address
     FROM user_crypto_addresses
     WHERE user_id = $1
       AND currency_code = $2
     LIMIT 1`,
    [userId, USDT_CURRENCY_CODE],
  );

  const address = result.rows[0]?.address;

  return isBase58TronAddress(address) ? address : null;
}

/* -------------------------------------------------------------------------- */
/* Solde du registre                                                          */
/* -------------------------------------------------------------------------- */

/** Solde USDT du compte CashPay (registre interne), pas celui de la blockchain. */
export async function getUsdtLedgerBalance(userId: number): Promise<number> {
  const result = await db.query(
    `SELECT balance
     FROM user_crypto_balances
     WHERE user_id = $1
       AND currency_code = $2`,
    [userId, USDT_CURRENCY_CODE],
  );

  const balance = Number(result.rows[0]?.balance ?? 0);

  return Number.isFinite(balance) ? balance : 0;
}

/* -------------------------------------------------------------------------- */
/* Dépôts                                                                     */
/* -------------------------------------------------------------------------- */

let eventIndexColumnPromise: Promise<boolean> | null = null;

/** La colonne event_index existe-t-elle dans crypto_deposits ? (mise en cache) */
function hasEventIndexColumn(): Promise<boolean> {
  if (!eventIndexColumnPromise) {
    eventIndexColumnPromise = db
      .query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_name = 'crypto_deposits'
           AND column_name = 'event_index'
         LIMIT 1`,
      )
      .then((result) => (result.rowCount ?? 0) > 0)
      .catch((error) => {
        eventIndexColumnPromise = null;
        throw error;
      });
  }

  return eventIndexColumnPromise;
}

/** Convertit une valeur brute (6 décimales) en texte décimal exact. */
function rawToDecimalString(raw: bigint): string {
  const whole = raw / 1_000_000n;
  const fraction = (raw % 1_000_000n).toString().padStart(6, '0');

  return `${whole.toString()}.${fraction}`;
}

/**
 * Enregistre un dépôt et crédite le solde, UNE seule fois.
 * Retourne true si le dépôt vient d'être crédité, false s'il existait déjà.
 */
async function creditUsdtDeposit(
  userId: number,
  txHash: string,
  eventIndex: number,
  amount: string,
): Promise<boolean> {
  const withEventIndex = await hasEventIndexColumn();
  const client = await db.getConnection();

  try {
    await client.query('BEGIN');

    // Empêche deux exécutions simultanées de créditer le même transfert.
    // Le verrou porte sur la transaction entière (tous ses transferts).
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `usdt-deposit:${txHash}`,
    ]);

    let alreadyCredited: boolean;

    if (withEventIndex) {
      const existing = await client.query(
        `SELECT id
         FROM crypto_deposits
         WHERE currency_code = $1
           AND tx_hash = $2
           AND event_index = $3
         LIMIT 1`,
        [USDT_CURRENCY_CODE, txHash, eventIndex],
      );

      alreadyCredited = (existing.rowCount ?? 0) > 0;
    } else {
      // Sans colonne event_index, plusieurs transferts d'une même transaction
      // partagent le même tx_hash : le transfert n° N est déjà crédité si la
      // base compte déjà plus de N lignes pour cette transaction (l'ordre des
      // transferts d'une transaction est stable d'une lecture à l'autre).
      const existing = await client.query(
        `SELECT count(*) AS credited
         FROM crypto_deposits
         WHERE currency_code = $1
           AND tx_hash = $2`,
        [USDT_CURRENCY_CODE, txHash],
      );

      alreadyCredited = Number(existing.rows[0]?.credited ?? 0) > eventIndex;
    }

    if (alreadyCredited) {
      await client.query('ROLLBACK');
      return false;
    }

    if (withEventIndex) {
      await client.query(
        `INSERT INTO crypto_deposits
           (user_id, currency_code, amount, tx_hash, event_index,
            status, confirmations, required_confirmations)
         VALUES ($1, $2, $3, $4, $5, 'confirmed', 1, 1)`,
        [userId, USDT_CURRENCY_CODE, amount, txHash, eventIndex],
      );
    } else {
      await client.query(
        `INSERT INTO crypto_deposits
           (user_id, currency_code, amount, tx_hash,
            status, confirmations, required_confirmations)
         VALUES ($1, $2, $3, $4, 'confirmed', 1, 1)`,
        [userId, USDT_CURRENCY_CODE, amount, txHash],
      );
    }

    await client.query(
      `INSERT INTO user_crypto_balances (user_id, currency_code, balance)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, currency_code)
       DO UPDATE SET balance = user_crypto_balances.balance + EXCLUDED.balance`,
      [userId, USDT_CURRENCY_CODE, amount],
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[USDT] Échec du rollback (dépôt) :', rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }
}

async function fetchIncomingTransfers(
  address: string,
): Promise<Trc20Transfer[]> {
  const host = process.env.TRON_FULL_HOST;

  if (!host) {
    throw new Error('TRON_FULL_HOST non configuré.');
  }

  const url = new URL(`/v1/accounts/${address}/transactions/trc20`, host);
  url.searchParams.set('only_confirmed', 'true');
  url.searchParams.set('only_to', 'true');
  url.searchParams.set('limit', '200');
  url.searchParams.set('contract_address', USDT_TRC20_CONTRACT);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url.toString(), {
      headers: process.env.TRON_API_KEY
        ? { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY }
        : {},
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`TRON provider HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { data?: Trc20Transfer[] };

    return payload.data ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/** Détecte et crédite les dépôts USDT reçus sur l'adresse d'un utilisateur. */
export async function syncUsdtDepositsForAddress(
  userId: number,
  address: string,
): Promise<{ received: number; credited: number }> {
  const transfers = await fetchIncomingTransfers(address);

  let credited = 0;
  const seenPerTx = new Map<string, number>();

  for (const transfer of transfers) {
    const txHash = transfer.transaction_id;
    const rawValue = transfer.value;

    if (
      !txHash ||
      transfer.to !== address ||
      (transfer.type && transfer.type !== 'Transfer') ||
      !rawValue ||
      !/^\d+$/.test(rawValue)
    ) {
      continue;
    }

    const raw = BigInt(rawValue);

    if (raw <= 0n) {
      continue;
    }

    // Plusieurs transferts d'une même transaction vers la même adresse :
    // on les distingue par leur rang dans la réponse.
    const eventIndex = seenPerTx.get(txHash) ?? 0;
    seenPerTx.set(txHash, eventIndex + 1);

    if (
      await creditUsdtDeposit(
        userId,
        txHash,
        eventIndex,
        rawToDecimalString(raw),
      )
    ) {
      credited++;
    }
  }

  return { received: transfers.length, credited };
}

const lastUserSync = new Map<number, number>();
const USER_SYNC_MIN_INTERVAL_MS = 15_000;

/**
 * Synchronisation "à la demande" pour un utilisateur (lecture du solde, de
 * l'historique…). Ne lève jamais d'erreur : un souci réseau ne doit pas
 * casser l'écran appelant. Limitée à une exécution toutes les 15 s par utilisateur.
 */
export async function syncUsdtDepositsForUser(
  userId: number,
): Promise<{ credited: number }> {
  try {
    if (!process.env.TRON_FULL_HOST) {
      return { credited: 0 };
    }

    const now = Date.now();
    const last = lastUserSync.get(userId) ?? 0;

    if (now - last < USER_SYNC_MIN_INTERVAL_MS) {
      return { credited: 0 };
    }

    lastUserSync.set(userId, now);

    const address = await getUserUsdtAddress(userId);

    if (!address) {
      return { credited: 0 };
    }

    const { credited } = await syncUsdtDepositsForAddress(userId, address);

    return { credited };
  } catch (error) {
    console.error('[USDT] Synchronisation utilisateur impossible :', error);
    return { credited: 0 };
  }
}

/** Synchronisation de tous les comptes (appelée par la tâche planifiée). */
export async function syncAllUsdtDeposits(): Promise<{
  addressesScanned: number;
  eventsReceived: number;
  depositsCredited: number;
  addressesFailed: number;
}> {
  const addresses = await db.query(
    `SELECT user_id, address
     FROM user_crypto_addresses
     WHERE currency_code = $1`,
    [USDT_CURRENCY_CODE],
  );

  const summary = {
    addressesScanned: 0,
    eventsReceived: 0,
    depositsCredited: 0,
    addressesFailed: 0,
  };

  const startedAt = Date.now();

  for (const row of addresses.rows) {
    // Garde-fou : on s'arrête avant de dépasser le délai d'une requête planifiée.
    if (Date.now() - startedAt > 50_000) {
      break;
    }

    if (!isBase58TronAddress(row.address)) {
      continue;
    }

    try {
      const { received, credited } = await syncUsdtDepositsForAddress(
        Number(row.user_id),
        row.address,
      );

      summary.addressesScanned++;
      summary.eventsReceived += received;
      summary.depositsCredited += credited;
    } catch (error) {
      summary.addressesFailed++;
      console.error('[USDT] Scan impossible pour', row.address, error);
    }

    // Reste sous la limite de requêtes du fournisseur TRON.
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return summary;
}

/* -------------------------------------------------------------------------- */
/* Retraits diffusés mais pas encore finalisés                                */
/* -------------------------------------------------------------------------- */

/**
 * Finalise les retraits USDT dont le TXID est connu mais qui sont restés
 * "pending" (confirmation trop lente, coupure juste après l'envoi…).
 * Le TXID est enregistré AVANT la diffusion (la transaction est signée d'abord).
 * - Confirmé sur la blockchain  -> retrait 'completed', transaction 'Completed'.
 * - Échoué sur la blockchain    -> solde recrédité (remboursement sûr).
 * - Jamais vue par le réseau APRÈS le délai d'expiration (une transaction TRON
 *   expire en 60 s ; par défaut on attend 30 min) -> elle n'a jamais été
 *   exécutée : solde recrédité.
 * - Nœud injoignable / délai pas écoulé -> on ne touche à rien, nouvel essai
 *   au prochain passage.
 */
export async function reconcilePendingUsdtWithdrawals(): Promise<{
  checked: number;
  completed: number;
  refunded: number;
  stillPending: number;
}> {
  const summary = { checked: 0, completed: 0, refunded: 0, stillPending: 0 };

  const pending = await db.query(
    `SELECT w.id,
            w.user_id,
            w.amount,
            w.tx_hash,
            t.id AS transaction_id,
            t.fee AS fee,
            EXTRACT(EPOCH FROM (NOW() - w.created_at)) AS age_seconds
     FROM crypto_withdrawals w
     LEFT JOIN transactions t
       ON t.metadata->>'withdrawalId' = w.id::text
      AND t.type_code = 'WD_CRYPTO_MONEY'
     WHERE w.currency_code = $1
       AND w.status = 'pending'
       AND w.tx_hash IS NOT NULL
       AND w.created_at < NOW() - INTERVAL '1 minute'
     ORDER BY w.id
     LIMIT 50`,
    [USDT_CURRENCY_CODE],
  );

  for (const row of pending.rows) {
    summary.checked++;

    const withdrawalId = Number(row.id);
    const transactionId = Number(row.transaction_id);

    if (!Number.isInteger(transactionId) || transactionId <= 0) {
      console.error('[USDT] Retrait sans transaction liée, à vérifier :', withdrawalId);
      summary.stillPending++;
      continue;
    }

    const outcome = await getTronTransactionOutcome(String(row.tx_hash));
    const ageMinutes = Number(row.age_seconds) / 60;
    const expiryMinutes =
      Number(process.env.TRON_WITHDRAWAL_EXPIRY_MINUTES) || 30;

    if (outcome === 'unknown') {
      summary.stillPending++;
      continue;
    }

    const expiredWithoutTrace =
      outcome === 'not_found' && ageMinutes >= expiryMinutes;

    if (outcome === 'not_found' && !expiredWithoutTrace) {
      // Peut-être pas encore dans un bloc : on attend.
      summary.stillPending++;
      continue;
    }

    if (outcome === 'failed' || expiredWithoutTrace) {
      const totalDebit = Number(
        (Number(row.amount) + Number(row.fee || 0)).toFixed(6),
      );

      const refunded = await refundCryptoWithdrawal({
        withdrawalId,
        transactionId,
        userId: Number(row.user_id),
        balanceCurrencyCode: USDT_CURRENCY_CODE,
        totalDebit,
        reason:
          outcome === 'failed'
            ? `Transaction TRON échouée (${row.tx_hash})`
            : `Transaction TRON jamais exécutée, expirée (${row.tx_hash})`,
      });

      if (refunded) {
        summary.refunded++;
      } else {
        summary.stillPending++;
      }

      continue;
    }

    // outcome === 'success'
    const client = await db.getConnection();

    try {
      await client.query('BEGIN');

      const marked = await client.query(
        `UPDATE crypto_withdrawals
         SET status = 'completed'
         WHERE id = $1
           AND status = 'pending'`,
        [withdrawalId],
      );

      if ((marked.rowCount ?? 0) === 1) {
        await client.query(
          `UPDATE transactions
           SET status = 'Completed',
               btc_tx_hash = $2
           WHERE id = $1`,
          [transactionId, String(row.tx_hash)],
        );
        summary.completed++;
      }

      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[USDT] Échec du rollback (réconciliation) :', rollbackError);
      }

      console.error('[USDT] Réconciliation impossible :', withdrawalId, error);
      summary.stillPending++;
    } finally {
      client.release();
    }
  }

  return summary;
}

/* -------------------------------------------------------------------------- */
/* Balayage des dépôts vers le portefeuille chaud (optionnel)                 */
/* -------------------------------------------------------------------------- */

export interface SweepSummary {
  enabled: boolean;
  busy: boolean;
  scanned: number;
  toppedUp: number;
  swept: number;
  skipped: number;
  failed: number;
}

/**
 * Ramène les USDT reçus sur les adresses des utilisateurs vers le portefeuille
 * chaud, qui paie les retraits. DÉSACTIVÉ par défaut : à activer avec
 * USDT_SWEEP_ENABLED=true une fois testé sur le réseau de test (Nile).
 *
 * Sans état : on lit le solde réel de chaque adresse, donc un passage raté se
 * rattrape tout seul au suivant. Le registre CashPay n'est jamais modifié ici
 * (le dépôt a déjà été crédité au moment de sa détection).
 *
 * Réglages (variables d'environnement, valeurs par défaut entre parenthèses) :
 *   USDT_SWEEP_MIN_USDT (5)            solde minimal pour balayer
 *   USDT_SWEEP_MIN_TRX (15)            TRX requis sur l'adresse pour le transfert
 *   USDT_SWEEP_TOPUP_TRX (20)          TRX visés quand on recharge l'adresse
 *   USDT_SWEEP_HOT_RESERVE_TRX (100)   TRX à toujours garder sur le portefeuille chaud
 *   USDT_SWEEP_MAX_ACTIONS (20)        actions maximum par passage
 */
export async function sweepUsdtDeposits(): Promise<SweepSummary> {
  const summary: SweepSummary = {
    enabled: process.env.USDT_SWEEP_ENABLED === 'true',
    busy: false,
    scanned: 0,
    toppedUp: 0,
    swept: 0,
    skipped: 0,
    failed: 0,
  };

  if (!summary.enabled) {
    return summary;
  }

  const trxToSun = (trx: number) => Math.round(trx * 1_000_000);
  const usdtToRaw = (usdt: number) => BigInt(Math.round(usdt * 1_000_000));

  const minUsdtRaw = usdtToRaw(Number(process.env.USDT_SWEEP_MIN_USDT) || 5);
  const minAddressTrxSun = trxToSun(Number(process.env.USDT_SWEEP_MIN_TRX) || 15);
  const topUpTargetSun = trxToSun(Number(process.env.USDT_SWEEP_TOPUP_TRX) || 20);
  const hotReserveSun = trxToSun(
    Number(process.env.USDT_SWEEP_HOT_RESERVE_TRX) || 100,
  );
  const maxActions = Number(process.env.USDT_SWEEP_MAX_ACTIONS) || 20;

  // Un seul balayage à la fois, même si la tâche planifiée se chevauche.
  const lockClient = await db.getConnection();

  try {
    const lock = await lockClient.query(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS ok',
      ['usdt-sweep'],
    );

    if (!lock.rows[0]?.ok) {
      summary.busy = true;
      return summary;
    }

    try {
      const hot = await getTronHotWalletStatus();
      let hotTrxSun = trxToSun(hot.trx);

      const addresses = await db.query(
        `SELECT user_id, address
         FROM user_crypto_addresses
         WHERE currency_code = $1
         ORDER BY user_id`,
        [USDT_CURRENCY_CODE],
      );

      const startedAt = Date.now();
      let actions = 0;

      for (const row of addresses.rows) {
        if (actions >= maxActions || Date.now() - startedAt > 45_000) {
          break;
        }

        const address = String(row.address);
        const userId = Number(row.user_id);

        // Ne jamais balayer le portefeuille chaud vers lui-même.
        if (!isBase58TronAddress(address) || address === hot.address) {
          continue;
        }

        try {
          summary.scanned++;

          const usdtRaw = await getTronUsdtRawBalance(address);

          if (usdtRaw < minUsdtRaw) {
            summary.skipped++;
            continue;
          }

          const plan = planSweep({
            usdtRaw,
            addressTrxSun: await getTrxBalanceSun(address),
            hotTrxSun,
            minUsdtRaw,
            minAddressTrxSun,
            topUpTargetSun,
            hotReserveSun,
          });

          if (plan.action === 'skip') {
            summary.skipped++;

            if (plan.reason === 'hot_wallet_low_trx') {
              console.error('[USDT] Balayage suspendu : TRX du portefeuille chaud trop bas.');
            }

            continue;
          }

          if (plan.action === 'topup') {
            const txid = await sendTrxFromHotWallet(address, plan.amountSun);
            hotTrxSun -= plan.amountSun;
            summary.toppedUp++;
            actions++;
            console.log('[USDT] TRX avancés pour balayage :', { userId, txid });
            // Le balayage a lieu au prochain passage, une fois le TRX confirmé.
            continue;
          }

          const txid = await sweepUsdtToHotWallet(userId, usdtRaw);
          summary.swept++;
          actions++;
          console.log('[USDT] Dépôt balayé :', {
            userId,
            txid,
            usdt: rawToDecimalString(usdtRaw),
          });
        } catch (error) {
          summary.failed++;
          console.error('[USDT] Balayage impossible pour', address, error);
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    } finally {
      await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [
        'usdt-sweep',
      ]);
    }
  } finally {
    lockClient.release();
  }

  return summary;
}
