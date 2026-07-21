import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to initiate a login request by sending an OTP.
 * In a real app, this would generate an OTP, save it with an expiry,
 * and send it to the user's preferred notification channel (SMS, WhatsApp, etc.).
 */
export async function POST(request: NextRequest) {
  const { walletId } = await request.json();

  if (!walletId) {
    return NextResponse.json({ success: false, error: 'Wallet ID is required.' }, { status: 400 });
  }

  // Mock logic: Simulate sending an OTP.
  console.log(`[API MOCK] Pretending to send OTP for walletId: ${walletId}`);
  
  // In a real app, you would look up the user by walletId to get their phone/email.
  const mockUserId = 123; // Example user ID

  return NextResponse.json({ 
    success: true, 
    message: `An OTP has been sent to the registered contact method for wallet ${walletId}.`,
    // Return the userId to be used in the verification step
    userId: mockUserId 
  });
}
