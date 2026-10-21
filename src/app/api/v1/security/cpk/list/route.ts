import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getHardwareSignatures } from '@/lib/actions/security.actions';

export const dynamic = 'force-dynamic';

export async function GET() {
try {
const user = await getAuthenticatedUser();

    if (!user) {
        return NextResponse.json(
            { success: false, error: 'Non authentifié.' },
            { status: 401 }
        );
    }

    const signatures = await getHardwareSignatures(user.id);

    return NextResponse.json({
        success: true,
        data: signatures
    });
} catch (error) {
    console.error('[CPK LIST]', error);
    return NextResponse.json(
        { success: false, error: 'Erreur lors de la récupération des clés.' },
        { status: 500 }
    );
}

}
