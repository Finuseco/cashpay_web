import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { User } from '@/lib/types';

export async function GET(request: Request, { params }: { params: { cpNumber: string } }) {
  try {
    const cpNumber = params.cpNumber;

    if (!cpNumber) {
        return NextResponse.json({ error: 'Wallet ID is required' }, { status: 400 });
    }

    const query = `
      SELECT 
        u.id, 
        u.id_wallet,
        u.full_name,
        u.phone,
        u.email,
        u.created_at,
        w.balances
      FROM users u
      LEFT JOIN wallets w ON u.id_wallet = w.id_wallet
      WHERE u.id_wallet = $1 AND u.role = 'Client'
    `;
    const { rows } = await db.query(query, [cpNumber.toUpperCase()]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const client = rows[0];
    client.balances = typeof client.balances === 'string' ? JSON.parse(client.balances) : client.balances;

    return NextResponse.json(client);
  } catch (error) {
    console.error('API Error fetching client:', error);
    if (error instanceof Error) {
        return NextResponse.json({ error: 'Failed to fetch client', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}
