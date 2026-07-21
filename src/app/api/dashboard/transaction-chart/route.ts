'use server';

import { NextResponse } from 'next/server';

// This is a mock API endpoint for the transaction chart on the dashboard.
// In a real application, this would perform an aggregation query on the 'transactions' table.
// For now, it returns a static dataset to ensure the component renders correctly.

const chartData = [
  { month: 'Janvier', transactions: 186 },
  { month: 'Février', transactions: 305 },
  { month: 'Mars', transactions: 237 },
  { month: 'Avril', transactions: 273 },
  { month: 'Mai', transactions: 209 },
  { month: 'Juin', transactions: 214 },
];


export async function GET() {
  try {
     // In a real scenario, you'd run a query like this:
     // SELECT DATE_FORMAT(timestamp, '%Y-%m') as month, COUNT(*) as transactions
     // FROM transactions
     // WHERE timestamp > NOW() - INTERVAL 6 MONTH
     // GROUP BY month
     // ORDER BY month ASC;
    
    // Simulate a network delay
    await new Promise(resolve => setTimeout(resolve, 750));
    return NextResponse.json(chartData);
  } catch (error) {
    console.error('API Error fetching transaction chart data:', error);
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });
  }
}
