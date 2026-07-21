
import { type NextRequest, NextResponse } from 'next/server';
import { authorizePurchase } from '@/services/purchases';

/**
 * Simulates the Visa Purchases API endpoint.
 * This is where Visa (or another card network) would send an authorization request
 * when a user's card is used for a purchase.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Purchase API] Received authorization request:', body);
    
    // In a real application, you would first validate the request source (e.g., via IP whitelisting, mutual TLS).

    const authRequest = {
        cardNumber: body.pan,
        amount: body.transaction.amount,
        currency: body.transaction.currency,
        merchantCategoryCode: body.merchant.categoryCode,
        transactionType: body.transaction.type,
    };
    
    // Call our internal service to decide whether to approve or decline.
    const decision = await authorizePurchase(authRequest);

    // Respond in the format expected by the card network.
    if (decision.approved) {
        return NextResponse.json({
            action: "approve",
            authorizationCode: `APP${Math.floor(100000 + Math.random() * 900000)}`,
        });
    } else {
        return NextResponse.json({
            action: "decline",
            reason: decision.reason,
        }, { status: 402 }); // 402 Payment Required is often used for declines
    }

  } catch (error) {
    console.error('[Purchase API] Error:', error);
    return NextResponse.json({
      action: "decline",
      reason: "Internal Server Error",
    }, { status: 500 });
  }
}
