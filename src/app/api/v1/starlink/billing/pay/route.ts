
import { NextResponse } from 'next/server';
import { validateApiSignature } from '@/lib/api-security';
import { processStarlinkSubscription } from '@/lib/actions/starlink.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

/**
 * API REST pour l'application mobile (Kotlin).
 * Déclenche un paiement souverain pour un abonnement Starlink.
 */
export async function POST(request: Request) {
    // 1. Validation de l'intégrité de la requête mobile
    const security = await validateApiSignature(request);
    if (!security.isValid) {
        return NextResponse.json({ success: false, error: security.error }, { status: 401 });
    }

    // 2. Vérification de la session utilisateur (Bearer Token)
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { terminalId, planName, pin } = body;

        if (!terminalId || !planName || !pin) {
            return NextResponse.json({ success: false, error: "Missing required fields: terminalId, planName, pin." }, { status: 400 });
        }

        const result = await processStarlinkSubscription({
            userId: user.id,
            terminalId,
            planName,
            pin
        });

        if (!result.success) {
            return NextResponse.json(result, { status: 402 }); // Payment Required / Failed
        }

        return NextResponse.json(result);

    } catch (e: any) {
        return NextResponse.json({ success: false, error: "Invalid JSON or Internal Error" }, { status: 400 });
    }
}
