import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function GET() {
  try {
    // Total from all user wallets
    const walletQuery = `
        SELECT 
            SUM(CAST(balances->>'USD' AS NUMERIC)) as "totalUsd",
            SUM(CAST(balances->>'CDF' AS NUMERIC)) as "totalCdf",
            SUM(CAST(balances->>'EUR' AS NUMERIC)) as "totalEur"
        FROM wallets;
    `;
    const { rows: walletRows } = await db.query(walletQuery);
    const totalCpBalances = walletRows[0] || { totalUsd: 0, totalCdf: 0, totalEur: 0 };
    
    // Fetch Stripe balance
    const stripeBalance = await stripe.balance.retrieve();
    const totalStripeBalance = {
        available: stripeBalance.available.map(b => ({ amount: b.amount / 100, currency: b.currency.toUpperCase() })),
        pending: stripeBalance.pending.map(b => ({ amount: b.amount / 100, currency: b.currency.toUpperCase() })),
    }

    return NextResponse.json({
        totalCpBalances,
        totalStripeBalance,
    });

  } catch (error) {
    console.error('API Error fetching total balances:', error);
    if (error instanceof Error) {
        return NextResponse.json({ error: 'Failed to fetch total balances', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to fetch total balances' }, { status: 500 });
  }
}
