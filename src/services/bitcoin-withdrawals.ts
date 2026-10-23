// Rapprochement des retraits Bitcoin restés "pending".
// Module serveur uniquement (pas de 'use server').
//
// Cas visé : le nœud Bitcoin Core a bien envoyé les BTC (la transaction porte
// la référence CashPay en commentaire), mais la finalisation en base n'a pas
// eu lieu (coupure juste après l'envoi, délai dépassé…). On retrouve l'envoi
// dans la liste du nœud et on finalise le retrait, sans jamais renvoyer de BTC.
//
// Ce module NE REMBOURSE JAMAIS : si le nœud ne retrouve pas l'envoi, le
// montant reste réservé et la vérification se fait à la main, comme avant.

import { db } from '@/lib/db';

interface NodeTransaction {
  category?: string;
  txid?: string;
  comment?: string;
}

export async function reconcileBitcoinWithdrawals(
  nodeTransactions: NodeTransaction[],
): Promise<number> {
  const pending = await db.query(
    `SELECT w.id AS withdrawal_id,
            t.id AS transaction_id,
            t.reference_code
     FROM crypto_withdrawals w
     JOIN transactions t
       ON t.metadata->>'withdrawalId' = w.id::text
      AND t.type_code = 'WD_CRYPTO_MONEY'
     WHERE w.currency_code = 'BTC'
       AND w.status = 'pending'
       AND w.created_at < NOW() - INTERVAL '1 minute'
     ORDER BY w.id
     LIMIT 50`,
  );

  if ((pending.rowCount ?? 0) === 0) {
    return 0;
  }

  const txidByReference = new Map<string, string>();

  for (const tx of nodeTransactions) {
    if (tx?.category === 'send' && tx.txid && tx.comment) {
      txidByReference.set(String(tx.comment), String(tx.txid));
    }
  }

  let finalized = 0;

  for (const row of pending.rows) {
    const txid = txidByReference.get(String(row.reference_code));

    if (!txid) {
      continue;
    }

    const client = await db.getConnection();

    try {
      await client.query('BEGIN');

      const marked = await client.query(
        `UPDATE crypto_withdrawals
         SET status = 'completed', tx_hash = $1
         WHERE id = $2
           AND status = 'pending'`,
        [txid, row.withdrawal_id],
      );

      if ((marked.rowCount ?? 0) === 1) {
        await client.query(
          `UPDATE transactions
           SET status = 'Completed', btc_tx_hash = $1
           WHERE id = $2`,
          [txid, row.transaction_id],
        );
        finalized++;
      }

      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[BTC] Échec du rollback (rapprochement) :', rollbackError);
      }

      console.error('[BTC] Rapprochement impossible :', row.withdrawal_id, error);
    } finally {
      client.release();
    }
  }

  return finalized;
}
