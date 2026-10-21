import { NextRequest, NextResponse } from 'next/server';
import { TronWeb } from 'tronweb';
import { db } from '@/lib/db';
import { USDT_TRC20_CONTRACT } from '@/services/tron';

export const dynamic = 'force-dynamic';

type TronEvent = {
  transaction_id?: string;
  event_index?: number | string;
  result?: {
    from?: string;
    to?: string;
    value?: string;
  };
};

function normalizeAddress(address: string, tron: TronWeb): string {
  if (/^(41)?[0-9a-fA-F]{40}$/.test(address)) {
    const hex = address.startsWith('41') ? address : `41${address}`;
    return tron.address.fromHex(hex);
  }

  if (address.startsWith('0x')) {
    return tron.address.fromHex(address.slice(2));
  }

  return address;
}

export async function POST(request: NextRequest) {
  const secret = process.env.USDT_SCAN_SECRET;

  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const host = process.env.TRON_FULL_HOST;
  if (!host) {
    return NextResponse.json(
      { success: false, error: 'TRON_FULL_HOST_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  const tron = new TronWeb({
    fullHost: host,
    ...(process.env.TRON_API_KEY
      ? { headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY } }
      : {}),
  });

  try {
    const url = new URL(
      `/v1/contracts/${USDT_TRC20_CONTRACT}/events`,
      host,
    );

    url.searchParams.set('event_name', 'Transfer');
    url.searchParams.set('only_confirmed', 'true');
    url.searchParams.set('limit', '200');
    url.searchParams.set('order_by', 'block_timestamp,desc');

    const response = await fetch(url.toString(), {
      headers: process.env.TRON_API_KEY
        ? { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY }
        : {},
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`TRON provider HTTP ${response.status}`);
    }

    const payload = await response.json() as { data?: TronEvent[] };
    const events = payload.data ?? [];

    let credited = 0;
    let ignored = 0;

    for (const event of events) {
      const txHash = event.transaction_id;
      const eventIndex = Number(event.event_index);
      const rawValue = event.result?.value;
      const rawTo = event.result?.to;

      if (
        !txHash ||
        !Number.isSafeInteger(eventIndex) ||
        eventIndex < 0 ||
        !rawValue ||
        !rawTo ||
        !/^\d+$/.test(rawValue)
      ) {
        ignored++;
        continue;
      }

      const rawAmount = BigInt(rawValue);
      if (rawAmount <= 0n) {
        ignored++;
        continue;
      }

      const amount = (Number(rawAmount) / 1_000_000).toFixed(6);
      const recipient = normalizeAddress(rawTo, tron);

      const client = await db.connect();

      try {
        await client.query('BEGIN');

        const owner = await client.query(
          `SELECT user_id
           FROM user_crypto_addresses
           WHERE currency_code = 'USDT_TRC20'
             AND address = $1
           LIMIT 1`,
          [recipient],
        );

        if (owner.rows.length === 0) {
          await client.query('ROLLBACK');
          ignored++;
          continue;
        }

        const userId = owner.rows[0].user_id;

        const inserted = await client.query(
          `INSERT INTO crypto_deposits
             (user_id, currency_code, amount, tx_hash, event_index,
              status, confirmations, required_confirmations)
           VALUES ($1, 'USDT_TRC20', $2, $3, $4,
                   'confirmed', 1, 1)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [userId, amount, txHash, eventIndex],
        );

        if (inserted.rows.length === 0) {
          await client.query('ROLLBACK');
          ignored++;
          continue;
        }

        await client.query(
          `INSERT INTO user_crypto_balances
             (user_id, currency_code, balance)
           VALUES ($1, 'USDT_TRC20', $2)
           ON CONFLICT (user_id, currency_code)
           DO UPDATE SET balance =
             user_crypto_balances.balance + EXCLUDED.balance`,
          [userId, amount],
        );

        await client.query('COMMIT');
        credited++;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    return NextResponse.json({
      success: true,
      currency: 'USDT_TRC20',
      eventsReceived: events.length,
      depositsCredited: credited,
      eventsIgnored: ignored,
    });
  } catch (error) {
    console.error('[USDT_TRC20_DEPOSIT_SYNC]', error);

    return NextResponse.json(
      { success: false, error: 'DEPOSIT_SYNC_FAILED' },
      { status: 500 },
    );
  }
}
