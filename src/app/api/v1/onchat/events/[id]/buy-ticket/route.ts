import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { buyEventTickets, quoteEventTicket } from '@/lib/ticket-purchase';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        const query = new URL(request.url).searchParams;
        const quote = await quoteEventTicket(user, params.id, Number(query.get('ticketTypeId')), Number(query.get('quantity') || 1), String(query.get('currency') || '').toUpperCase());
        return NextResponse.json({ success: true, quote });
    } catch (error) { return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 }); }
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        const body = await request.json();
        if (body.consent !== true) return NextResponse.json({ success: false, error: 'Confirmez explicitement le paiement.' }, { status: 400 });
        return NextResponse.json(await buyEventTickets(user, params.id, Number(body.ticketTypeId), Number(body.quantity ?? 1), String(body.paymentCurrency || '').toUpperCase(), body.pin, body.maxDebit));
    } catch (error) { return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 }); }
}
