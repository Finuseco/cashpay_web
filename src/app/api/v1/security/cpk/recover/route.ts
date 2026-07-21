
import { NextResponse } from 'next/server';
import { recoverSignedBalance } from '@/lib/actions/security.actions';

/**
 * API : Encaisser une clé matérielle vers le portefeuille utilisateur
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { signature, keyPin } = body;

        if (!signature) {
            return NextResponse.json({ success: false, error: "Signature manquante" }, { status: 400 });
        }

        const result = await recoverSignedBalance({ signature, keyPin });

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json(result);
    } catch (e) {
        return NextResponse.json({ success: false, error: "Erreur interne" }, { status: 500 });
    }
}
