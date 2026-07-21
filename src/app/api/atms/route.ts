import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const atmSchema = z.object({
  location: z.string().min(5, 'Location is required (min 5 chars).'),
  agencyId: z.string().nonempty('Please select an agency.'),
  initialUsd: z.coerce.number().min(0, 'Initial USD cash must be 0 or more.'),
  initialCdf: z.coerce.number().min(0, 'Initial CDF cash must be 0 or more.'),
});

export async function GET() {
  try {
    const { rows } = await db.query('SELECT * FROM atms ORDER BY created_at DESC');
    const atms = (rows as any[]).map(atm => ({
      ...atm,
      cash_levels: typeof atm.cash_levels === 'string' ? JSON.parse(atm.cash_levels) : atm.cash_levels,
    }));
    return NextResponse.json(atms);
  } catch (error) {
    console.error('API Error fetching ATMs:', error);
    return NextResponse.json({ error: 'Failed to fetch ATMs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = atmSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    const { location, agencyId, initialUsd, initialCdf } = validation.data;
    const newAtm = {
      id: `ATM_${randomUUID()}`,
      location,
      agency_id: agencyId,
      status: (initialUsd > 0 || initialCdf > 0) ? 'Active' : 'Out of Service',
      cash_levels: JSON.stringify({ USD: initialUsd, CDF: initialCdf }),
      last_transaction: new Date(),
      created_at: new Date(),
    };

    await db.query('INSERT INTO atms (id, location, agency_id, status, cash_levels, last_transaction, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', Object.values(newAtm));

    return NextResponse.json(newAtm, { status: 201 });
  } catch (error) {
    console.error('API Error creating ATM:', error);
    return NextResponse.json({ error: 'Failed to create ATM' }, { status: 500 });
  }
}
