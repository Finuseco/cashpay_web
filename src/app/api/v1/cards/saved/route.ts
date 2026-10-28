import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import {
    saveCardForUser,
    getSavedCardsForCurrentUser,
    deleteSavedCardForCurrentUser,
} from '@/lib/actions/card.actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/cards/saved
 * Liste les cartes de paiement sauvegardées de l'utilisateur connecté.
 * Retourne uniquement last4, brand, expiry — jamais le PAN ni le token chiffré.
 */
export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const cards = await getSavedCardsForCurrentUser();
    return NextResponse.json({
        success: true,
        cards: cards.map(c => ({
            id: c.id,
            brand: c.card_brand,
            cardHolderName: c.card_holder_name,
            last4: c.last4,
            expiryMonth: c.expiry_month,
            expiryYear: c.expiry_year,
            isPrimary: c.is_primary,
            createdAt: c.created_at,
        })),
    });
}

/**
 * POST /api/v1/cards/saved
 * Sauvegarde une nouvelle carte de paiement.
 *
 * Body JSON:
 * {
 *   cardHolderName: string
 *   cardNumber: string       (PAN — chiffré côté serveur avant stockage)
 *   expiryMonth: string      ("01"–"12")
 *   expiryYear: string       ("2025"–"2035")
 *   brand?: "visa" | "mastercard" | "card"
 *   setPrimary?: boolean
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

    const { cardHolderName, cardNumber, expiryMonth, expiryYear, brand, setPrimary } = body;

    if (!cardHolderName || !cardNumber || !expiryMonth || !expiryYear) {
        return NextResponse.json({
            success: false,
            error: 'Champs requis : cardHolderName, cardNumber, expiryMonth, expiryYear.',
        }, { status: 400 });
    }

    const result = await saveCardForUser({
        cardHolderName: String(cardHolderName).trim(),
        cardNumber: String(cardNumber).replace(/\s/g, ''),
        expiryMonth: String(expiryMonth).padStart(2, '0'),
        expiryYear: String(expiryYear),
        brand: brand || 'card',
        setPrimary: Boolean(setPrimary),
    });

    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
        success: true,
        card: {
            id: result.card!.id,
            brand: result.card!.card_brand,
            cardHolderName: result.card!.card_holder_name,
            last4: result.card!.last4,
            expiryMonth: result.card!.expiry_month,
            expiryYear: result.card!.expiry_year,
            isPrimary: result.card!.is_primary,
        },
    }, { status: 201 });
}

/**
 * DELETE /api/v1/cards/saved?id=123
 * Supprime une carte sauvegardée appartenant à l'utilisateur connecté.
 */
export async function DELETE(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ success: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardId = Number(searchParams.get('id'));
    if (!cardId || isNaN(cardId)) {
        return NextResponse.json({ success: false, error: 'Paramètre id manquant ou invalide.' }, { status: 400 });
    }

    const result = await deleteSavedCardForCurrentUser(cardId);
    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Carte supprimée.' });
}
