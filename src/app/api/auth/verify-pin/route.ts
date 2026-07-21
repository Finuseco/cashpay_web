import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to verify a user's transaction PIN.
 * This should be an authenticated route.
 */
export async function POST(request: NextRequest) {
  // In a real app, you would first verify the JWT from the Authorization header.
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  
  const { pin } = await request.json();

  if (!pin) {
    return NextResponse.json({ success: false, error: 'PIN is required.' }, { status: 400 });
  }

  // Mock logic: If PIN is '1234', it's correct.
  if (pin === '1234') {
    return NextResponse.json({ success: true, message: 'PIN verified.' });
  } else {
    return NextResponse.json({ success: false, error: 'Invalid PIN.' }, { status: 401 });
  }
}
