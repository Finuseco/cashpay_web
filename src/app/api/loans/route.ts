
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT 
        l.id,
        u.full_name as clientName,
        u.id_wallet as cpNumber,
        l.amount,
        l.currency,
        l.status,
        l.request_date as requestDate,
        l.duration,
        l.interest_rate as interestRate,
        'N/A' as repaymentStatus, 
        0 as amountDue,
        0 as latePayments,
        0 as penaltyAmount,
        'Low' as riskScore,
        SUBSTRING(u.id_wallet, 3, 2) as agencyId
      FROM loans l
      JOIN users u ON l.user_id = u.id
      ORDER BY l.request_date DESC
    `;
    const { rows } = await db.query(query);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('API Error fetching loans:', error);
    return NextResponse.json({ error: 'Failed to fetch loans' }, { status: 500 });
  }
}
