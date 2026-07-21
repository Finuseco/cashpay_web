import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to verify the OTP for login.
 * In a real app, this would check the OTP against a stored value in the DB/cache
 * and, if valid, generate a JWT.
 */
export async function POST(request: NextRequest) {
  const { userId, otp } = await request.json();

  if (!userId || !otp) {
    return NextResponse.json({ success: false, error: 'User ID and OTP are required.' }, { status: 400 });
  }

  // Mock logic: If OTP is '123456', login is successful.
  if (otp === '123456') {
    // Mock user data and JWT
    const mockUser = {
      id: userId,
      full_name: "John Doe",
      email: "john.doe@example.com",
      id_wallet: `CD${userId.toString().padStart(10, '0')}`,
      // ... other user fields
    };
    const mockToken = `mock-jwt-token-for-user-${userId}`;
    
    return NextResponse.json({ 
        success: true, 
        token: mockToken, 
        user: mockUser 
    });
  } else {
    return NextResponse.json({ success: false, error: 'Invalid OTP.' }, { status: 401 });
  }
}
