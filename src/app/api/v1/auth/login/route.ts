import { NextResponse } from 'next/server';
import { findUserForLogin } from '@/lib/actions/auth.actions';
import { db } from '@/lib/db';

/**
 * API : Initiation de connexion (Mobile).
 *
 * Identification possible par :
 * - Wallet ID
 * - Numéro de téléphone avec ou sans "+"
 *
 * Le système existant findUserForLogin() reste utilisé afin de
 * conserver intégralement les canaux OTP et méthodes de défi existants.
 */
export async function POST(request: Request) {
    let connection;

    try {
        const body = await request.json();

        const walletId =
            typeof body.walletId === 'string'
                ? body.walletId.trim()
                : '';

        const phoneInput =
            typeof body.phone === 'string'
                ? body.phone.trim()
                : '';

        // ============================================================
        // 1. CONNEXION PAR WALLET ID
        // ============================================================
        if (walletId) {
            const result = await findUserForLogin(walletId);

            if (!result.success) {
                return NextResponse.json(result, { status: 404 });
            }

            return NextResponse.json(result);
        }

        // ============================================================
        // 2. CONNEXION PAR NUMÉRO DE TÉLÉPHONE
        // ============================================================
        if (!phoneInput) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Wallet ID ou numéro de téléphone requis.'
                },
                { status: 400 }
            );
        }

        // Le serveur ne stocke pas le "+"
        // Exemple :
        // +243833248614 -> 243833248614
        // 243833248614  -> 243833248614
        const normalizedPhone = phoneInput.replace(/^\+/, '');

        // Le numéro doit uniquement contenir des chiffres après
        // suppression éventuelle du "+"
        if (!/^\d+$/.test(normalizedPhone)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Numéro de téléphone invalide.'
                },
                { status: 400 }
            );
        }

        connection = await db.getConnection();

        // Recherche avec exactement la même valeur que celle
        // stockée dans users.phone, sans le "+"
        const { rows } = await connection.query(
            `
            SELECT id_wallet
            FROM users
            WHERE phone = $1
            LIMIT 1
            `,
            [normalizedPhone]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Numéro de téléphone non trouvé.'
                },
                { status: 404 }
            );
        }

        const userWalletId = rows[0].id_wallet;

        // IMPORTANT :
        // On repasse par la fonction existante afin de conserver
        // les canaux OTP et les méthodes de connexion déjà existants.
        const result = await findUserForLogin(userWalletId);

        if (!result.success) {
            return NextResponse.json(result, { status: 404 });
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error('[API V1 AUTH LOGIN]', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Erreur interne'
            },
            { status: 500 }
        );
    } finally {
        if (connection) {
            connection.release();
        }
    }
}
