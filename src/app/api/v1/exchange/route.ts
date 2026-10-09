import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { verifyUserPin } from '@/lib/actions/auth.actions';
import { createTransaction } from '@/lib/actions/transaction.actions';
import { countryToCode } from '@/lib/utils';

export async function POST(request: NextRequest) {
    try {
        // 1. L'utilisateur est toujours identifié par la session/token.
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Utilisateur non authentifié.'
                },
                { status: 401 }
            );
        }

        const body = await request.json();

        const amount = Number(body.amount);

        const fromCurrency = String(
            body.fromCurrency || body.from_currency || ''
        ).trim().toUpperCase();

        const toCurrency = String(
            body.toCurrency || body.to_currency || ''
        ).trim().toUpperCase();

        const pin = String(body.pin || '').trim();

        // 2. Validation des données envoyées par le client.
        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Montant invalide.'
                },
                { status: 400 }
            );
        }

        if (!fromCurrency || !toCurrency) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Devise source et devise destination obligatoires.'
                },
                { status: 400 }
            );
        }

        if (fromCurrency === toCurrency) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Les deux devises doivent être différentes.'
                },
                { status: 400 }
            );
        }

        if (!pin) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Code PIN obligatoire.'
                },
                { status: 400 }
            );
        }

        // 3. Vérification du PIN de l'utilisateur connecté.
        //    On conserve exactement le mécanisme existant.
        const pinResult = await verifyUserPin(user.id, pin);

        if (!pinResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Code PIN incorrect.'
                },
                { status: 401 }
            );
        }

        // 4. Le pays vient UNIQUEMENT du profil authentifié.
        //    Android ne fournit pas countryCode.
        const countryCode = countryToCode(user.country);

        if (!countryCode) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Pays de l’utilisateur non reconnu.'
                },
                { status: 400 }
            );
        }

        // 5. Recherche du taux directement dans exchange_rates.
        //    Le taux dépend du pays + devise source + devise destination.
        const { rows } = await db.query(
            `SELECT rate
             FROM exchange_rates
             WHERE country_code = $1
               AND from_currency = $2
               AND to_currency = $3
             LIMIT 1`,
            [
                countryCode,
                fromCurrency,
                toCurrency
            ]
        );

        if (rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Le taux de change ${fromCurrency}/${toCurrency} n'est pas configuré pour votre pays.`
                },
                { status: 400 }
            );
        }

        const rate = Number(rows[0].rate);

        if (!Number.isFinite(rate) || rate <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Taux de change invalide.'
                },
                { status: 500 }
            );
        }

        // 6. Le montant destination est toujours recalculé
        //    côté serveur à partir du taux de la base.
        const toAmount = amount * rate;

        // 7. IMPORTANT :
        //    On conserve le moteur existant.
        //    createTransaction() s'occupe notamment :
        //    - du débit de la devise source ;
        //    - du crédit de la devise destination ;
        //    - de la vérification du solde ;
        //    - de la transaction PostgreSQL ;
        //    - de l'enregistrement dans transactions ;
        //    - de la référence ;
        //    - des notifications ;
        //    - des soldes retournés.
        const result = await createTransaction({
            user,
            typeCode: 'EXCHANGE',
            amount,
            currency: fromCurrency,
            description: `Échange ${fromCurrency} vers ${toCurrency}`,
            metadata: {
                channel: 'API',
                fromCurrency,
                toCurrency,
                toAmount,
                rate
            }
        });

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error
                },
                { status: 400 }
            );
        }

        // 8. Réponse conservée pour Android.
        return NextResponse.json({
            success: true,
            reference: result.reference,
            transactionId: result.transactionId,
            amount,
            fromCurrency,
            toCurrency,
            rate,
            toAmount,
            fee: result.fee || 0,
            senderNewBalance: result.senderNewBalance
        });

    } catch (error: any) {
        console.error('Exchange API error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error?.message || 'Erreur lors de l’échange.'
            },
            { status: 500 }
        );
    }
}
