import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const chequeSchema = z.object({
  beneficiaryName: z.string().min(3, "Le nom du bénéficiaire est requis."),
  amount: z.coerce.number().positive("Le montant doit être supérieur à zéro."),
  currency: z.enum(['USD', 'CDF', 'EUR']),
  validityDate: z.coerce.date(),
  reason: z.string().min(5),
  issuerUserId: z.string(), // This should be retrieved from the user's session
  issuerWalletId: z.string(),
});

export async function GET() {
  try {
    const query = `
      SELECT 
        dc.*,
        u.full_name as "issuerName"
      FROM digital_cheques dc
      JOIN users u ON dc.issuer_user_id = u.id
      ORDER BY dc.issue_date DESC
    `;
    const { rows } = await db.query(query);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('API Error fetching cheques:', error);
    return NextResponse.json({ error: 'Failed to fetch cheques' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = chequeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }
    const data = validation.data;
    const newCheque = {
      id: `CHQ_${randomUUID()}`,
      issuer_user_id: data.issuerUserId,
      beneficiary_name: data.beneficiaryName,
      amount: data.amount,
      currency: data.currency,
      reason: data.reason,
      issue_date: new Date(),
      validity_date: new Date(data.validityDate),
      status: 'Valid',
    };

    await db.query('INSERT INTO digital_cheques (id, issuer_user_id, beneficiary_name, amount, currency, reason, issue_date, validity_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', Object.values(newCheque));
    return NextResponse.json({ ...newCheque, issuerName: 'Current User' }, { status: 201 });
  } catch (error) {
    console.error('API Error creating cheque:', error);
    return NextResponse.json({ error: 'Failed to create cheque' }, { status: 500 });
  }
}
