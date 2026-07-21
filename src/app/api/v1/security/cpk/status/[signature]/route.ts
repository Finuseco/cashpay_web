
import { NextResponse } from 'next/server';
import { getHardwareKeyDetails } from '@/lib/actions/security.actions';

/**
 * API : Vérifier le statut d'une clé H (Reader API)
 * Endpoint: GET /api/v1/security/cpk/status/{signature}
 */
export async function GET(
    request: Request,
    { params }: { params: { signature: string } }
) {
    const { signature } = params;

    if (!signature) {
        return NextResponse.json({ success: false, error: "Signature manquante" }, { status: 400 });
    }

    try {
        const result = await getHardwareKeyDetails(signature);

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
