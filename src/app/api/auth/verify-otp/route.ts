import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to verify the OTP sent during registration.
 * In a real app, this would check against a stored OTP.
 */
export async function POST(request: NextRequest) {
  const { phone, otp } = await request.json();

  if (!phone || !otp) {
    return NextResponse.json({ success: false, error: 'Phone and OTP are required.' }, { status: 400 });
  }

  // Mock logic: If OTP is '123456', verification is successful.
  if (otp === '123456') {
    // A temporary token could be used to secure the next step (completing profile)
    const temporaryToken = `temp-token-for-${phone}`;
    return NextResponse.json({ success: true, message: 'OTP verified.', tempToken: temporaryToken });
  } else {
    return NextResponse.json({ success: false, error: 'Invalid OTP.' }, { status: 401 });
  }
}
