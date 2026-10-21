import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

export async function GET(
request: Request,
{ params }: { params: { signature: string } }
) {
try {
const user = await getAuthenticatedUser();

    if (!user) {
        return NextResponse.json(
            { success: false, error: 'Non authentifié.' },
            { status: 401 }
        );
    }

    const signature = params.signature;

    if (!signature) {
        return NextResponse.json(
            { success: false, error: 'Signature manquante.' },
            { status: 400 }
        );
    }

    const { rows } = await db.query(
        `SELECT id, key_reference, amount, currency, security_level,
                status, created_at, claimed_at
         FROM hardware_keys
         WHERE hsm_signature = $1
           AND owner_user_id = $2
         LIMIT 1`,
        [signature, user.id]
    );

    if (rows.length === 0) {
        return NextResponse.json(
            { success: false, error: 'Clé introuvable ou accès non autorisé.' },
            { status: 404 }
        );
    }

    return NextResponse.json({
        success: true,
        key: rows[0]
    });
} catch (error) {
    console.error('[CPK STATUS]', error);
    return NextResponse.json(
        { success: false, error: 'Erreur lors de la consultation du statut.' },
        { status: 500 }
    );
}

}
