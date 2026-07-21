
import { type NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to fetch a user's virtual and physical cards.
 * This is a mock endpoint.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  // Mock data: A list of user's cards
  const mockCards = [
    { 
        id: 'vc_123', 
        card_type: 'virtuelle', 
        brand: 'visa', 
        currency: 'USD',
        last4: '4242',
        expiry_date: '12/26',
        status: 'active'
    },
     { 
        id: 'vc_456', 
        card_type: 'virtuelle', 
        brand: 'mastercard', 
        currency: 'EUR',
        last4: '5555',
        expiry_date: '08/25',
        status: 'active'
    },
    { 
        id: 'pc_789', 
        card_type: 'physique', 
        brand: 'visa', 
        currency: 'USD',
        last4: '1234',
        expiry_date: '01/28',
        status: 'inactive'
    },
  ];
  
  return NextResponse.json({ success: true, cards: mockCards });
}
