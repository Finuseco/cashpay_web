
import { NextResponse } from 'next/server';
import { validateApiSignature } from '@/lib/api-security';
import { saveResellerConfig, getResellerConfigForApp } from '@/lib/actions/starlink.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

/**
 * PONT API STARLINK : Configuration et Authentification Entreprise.
 * Ce port sert de passerelle entre l'application mobile et la base de données CashPay.
 */

/**
 * RÉCUPÉRATION (GET) : Retourne les identifiants configurés pour l'utilisateur.
 * Utilisé par l'app mobile (Kotlin/C++) pour s'authentifier auprès de Starlink.
 */
export async function GET(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: "Session non valide." }, { status: 401 });

    try {
        const config = await getResellerConfigForApp(user.id);
        if (!config) {
            return NextResponse.json({ success: true, configured: false });
        }
        return NextResponse.json({ success: true, configured: true, data: config });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

/**
 * TRANSMISSION (POST) : Reçoit les clés Starlink et le compte CashPay depuis le mobile.
 * Chiffre et stocke les données dans le Vault serveur.
 */
export async function POST(request: Request) {
    const security = await validateApiSignature(request);
    if (!security.isValid) return NextResponse.json({ success: false, error: security.error }, { status: 401 });

    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ success: false, error: "Session expirée." }, { status: 401 });

    try {
        const body = await request.json();
        const { companyName, merchantWalletId, starlinkClientId, starlinkClientSecret } = body;

        if (!companyName || !merchantWalletId || !starlinkClientId || !starlinkClientSecret) {
            return NextResponse.json({ success: false, error: "Tous les champs sont obligatoires." }, { status: 400 });
        }

        const result = await saveResellerConfig({
            userId: user.id,
            companyName,
            merchantWalletId,
            starlinkClientId,
            starlinkClientSecret
        });

        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ success: false, error: "Erreur lors du stockage des données." }, { status: 400 });
    }
}
