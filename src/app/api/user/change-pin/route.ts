
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint for a user to change their PIN.
 * This should be an authenticated route.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { oldPin, newPin } = await request.json();

  if (!oldPin || !newPin) {
    return NextResponse.json({ success: false, error: 'Old PIN and new PIN are required.' }, { status: 400 });
  }
  
  if (newPin.length !== 4) {
    return NextResponse.json({ success: false, error: 'New PIN must be 4 digits.' }, { status: 400 });
  }

  // Mock logic:
  // 1. Verify the old PIN against the stored hash in the database.
  if (oldPin !== '1234') { // Assume '1234' is the current correct PIN
      return NextResponse.json({ success: false, error: 'Incorrect old PIN.' }, { status: 401 });
  }
  
  // 2. Hash the new PIN and update it in the database.
  console.log(`[API MOCK] User PIN changed successfully.`);

  return NextResponse.json({ 
    success: true, 
    message: 'PIN successfully updated.'
  });
}
