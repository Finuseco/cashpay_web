import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createEvent } from '@/lib/actions/event.actions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/onchat/events/create
 * Crée un événement depuis l'application mobile Android.
 *
 * Body JSON:
 * {
 *   name: string
 *   description: string
 *   location?: string
 *   date: string  (ISO)
 *   time: string  ("HH:MM")
 *   currency: string
 *   imageUrl?: string  (base64 ou URL)
 *   eventType: "live" | "zoom"
 *   ticketTypes: Array<{ type: string, price: number, quantity: number }>
 * }
 */
export async function POST(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: 'Body JSON invalide.' }, { status: 400 });
    }

    const { name, description, location, date, time, currency, imageUrl, eventType, ticketTypes } = body;

    if (!name || !description || !date || !time || !currency) {
        return NextResponse.json({
            success: false,
            error: 'Champs requis manquants : name, description, date, time, currency.'
        }, { status: 400 });
    }

    if (!Array.isArray(ticketTypes) || ticketTypes.length === 0) {
        return NextResponse.json({
            success: false,
            error: 'Au moins un type de ticket est requis.'
        }, { status: 400 });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ success: false, error: 'Date invalide.' }, { status: 400 });
    }

    const result = await createEvent({
        name: String(name).trim(),
        description: String(description).trim(),
        location: location ? String(location).trim() : undefined,
        date: parsedDate,
        time: String(time),
        currency: String(currency).toUpperCase(),
        imageUrl: imageUrl || undefined,
        eventType: eventType === 'zoom' ? 'zoom' : 'live',
        ticketTypes: ticketTypes.map((tt: any) => ({
            type: String(tt.type || 'Standard'),
            price: Number(tt.price || 0),
            quantity: Math.max(1, Number(tt.quantity || 1)),
        })),
    });

    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
        success: true,
        event: {
            id: String(result.event?.id),
            name: result.event?.name,
        },
        message: 'Événement créé avec succès.',
    }, { status: 201 });
}
