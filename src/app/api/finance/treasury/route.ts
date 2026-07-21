'use server';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Mock data representing internal revenue wallets. In a real app, this would be fetched from the DB.
const mockCashPayRevenue = {
  byType: {
    withdrawal_fees: 7850.25,
    transfer_fees: 12340.50,
    loan_interest: 5678.90,
  },
  byCurrency: {
    USD: 25869.65,
    CDF: 15400000.00,
    EUR: 9850.00
  }
};

// Mock PayPal balance. In a real app, this would be an API call.
const mockPayPalBalance = {
  currency: 'USD',
  amount: 21540.75
};

export async function GET() {
  try {
    // Fetch Stripe balance
    const stripeBalance = await stripe.balance.retrieve();
    const formattedStripeBalance = {
      available: stripeBalance.available.map(b => ({ amount: b.amount / 100, currency: b.currency.toUpperCase() })),
      pending: stripeBalance.pending.map(b => ({ amount: b.amount / 100, currency: b.currency.toUpperCase() })),
    };

    return NextResponse.json({
      cashpayRevenue: mockCashPayRevenue,
      stripeBalance: formattedStripeBalance,
      paypalBalance: mockPayPalBalance,
    });

  } catch (error) {
    console.error('API Error fetching treasury data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch treasury data';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
