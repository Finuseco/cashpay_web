import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint for the first step of user registration.
 * It receives a phone number and sends an OTP.
 */
export async function POST(request: NextRequest) {
  const { phone, countryCode } = await request.json();

  if (!phone || !countryCode) {
    return NextResponse.json({ success: false, error: 'Phone number and country code are required.' }, { status: 400 });
  }

  // Mock logic: Simulate generating and sending an OTP
  console.log(`[API MOCK] Pretending to generate and send OTP to ${phone} in country ${countryCode}.`);
  
  return NextResponse.json({ success: true, message: 'OTP sent successfully.' });
}
