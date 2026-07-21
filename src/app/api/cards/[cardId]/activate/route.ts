
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { activatePhysicalCard } from '@/lib/actions/card.actions';

/**
 * API endpoint for a user to activate their physical card.
 * This should be an authenticated route.
 */
export async function POST(request: NextRequest, { params }: { params: { cardId: string } }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const cardId = params.cardId;

  try {
    const result = await activatePhysicalCard(cardId, user.id);

    if (result.success && result.card) {
      return NextResponse.json({ success: true, card: result.card });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    
  } catch (error) {
    console.error(`[API Activate Card] Error for card ${cardId}:`, error);
    return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
  }
}
