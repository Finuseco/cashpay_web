import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createTransaction } from '@/lib/actions/transaction.actions';
import { initiateDeposit } from '@/lib/actions/deposit.actions';

const OPERATORS = new Set([
    'mpesa',
    'orange_money',
    'airtel_money',
    'afrimoney',
    'mtn_momo',
]);

const WAIT_MS = 30000;
const POLL_MS = 1000;

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    status: 'Failed',
                    error: 'Utilisateur non authentifié.',
                },
                { status: 401 }
            );
        }

        const body = await request.json();

        const method = String(body.method || 'mobile_money')
            .trim()
            .toLowerCase();

        const operator = String(body.operator || '')
            .trim()
            .toLowerCase();

        const amount = Number(body.amount);

        const currency = String(body.currency || '')
            .trim()
            .toUpperCase();

        const phoneNumber = String(body.phoneNumber || body.phone_number || '')
            .trim();

        if (method !== 'mobile_money') {
            return NextResponse.json(
                {
                    success: false,
                    status: 'Failed',
                    error: 'Cette route accepte actuellement uniquement les dépôts Mobile Money.',
                },
                { status: 400 }
            );
        }

        if (!OPERATORS.has(operator)) {
            return NextResponse.json(
                {
                    success: false,
                    status: 'Failed',
                    error: 'Opérateur Mobile Money non supporté.',
                    supportedOperators: [
                        'mpesa',
                        'orange_money',
                        'airtel_money',
                        'afrimoney',
                        'mtn_momo',
                    ],
                },
                { status: 400 }
            );
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    status: 'Failed',
                    error: 'Montant invalide.',
                },
                { status: 400 }
            );
        }

        if (!currency) {
            return NextResponse.json(
                {
                    success: false,
                    status: 'Failed',
                    error: 'Devise obligatoire.',
                },
                { status: 400 }
            );
        }

        if (!phoneNumber) {
            return NextResponse.json(
                {
                    success: false,
                    status: 'Failed',
                    error: 'Numéro Mobile Money obligatoire.',
                },
                { status: 400 }
            );
        }

        /*
         * 1. Création de la transaction CashPay en Pending.
         *
         * Le type DP est déjà reconnu par createTransaction()
         * comme une transaction de crédit.
         *
         * À ce stade le wallet n'est PAS crédité.
         */
        const pending = await createTransaction({
            user,
            typeCode: 'DP',
            amount,
            currency,
            description: `Dépôt Mobile Money - ${operator}`,
            status: 'Pending',
            metadata: {
                channel: 'MAXICASH',
                method: 'mobile_money',
                operator,
                phoneNumber,
            },
        });

        if (!pending.success || !pending.reference) {
            return NextResponse.json(
                {
                    success: false,
                    status: 'Failed',
                    error: pending.error || 'Impossible de créer le dépôt.',
                },
                { status: 400 }
            );
        }

        const reference = pending.reference;

        /*
         * 2. Demande de paiement auprès de MaxiCash.
         */
        const maxiCash = await initiateDeposit({
            amount,
            user,
            countryCode: String(user.country || ''),
            operator,
            phoneNumber,
            paymentMethod: 'mobile_money',
        });

        if (!maxiCash.success) {
            await db.query(
                `UPDATE transactions
                 SET status = 'Failed',
                     metadata = COALESCE(metadata, '{}'::jsonb) ||
                         $1::jsonb
                 WHERE reference_code = $2
                   AND status = 'Pending'`,
                [
                    JSON.stringify({
                        initiation_error: maxiCash.message || 'Échec de l’initiation MaxiCash',
                    }),
                    reference,
                ]
            );

            return NextResponse.json(
                {
                    success: false,
                    status: 'Failed',
                    reference,
                    error: maxiCash.message || 'Échec de l’initiation MaxiCash.',
                },
                { status: 400 }
            );
        }

        /*
         * 3. Enregistrement de la référence MaxiCash.
         */
        await db.query(
            `UPDATE transactions
             SET metadata = COALESCE(metadata, '{}'::jsonb) ||
                 $1::jsonb
             WHERE reference_code = $2
               AND status = 'Pending'`,
            [
                JSON.stringify({
                    externalReference: maxiCash.transactionId,
                    provider: 'MAXICASH',
                }),
                reference,
            ]
        );

        /*
         * 4. Attente courte de la confirmation du webhook.
         *
         * Le webhook modifie la transaction.
         * Dès que son statut devient Completed ou Failed,
         * cette requête retourne le résultat.
         */
        const deadline = Date.now() + WAIT_MS;

        while (Date.now() < deadline) {
            const { rows } = await db.query(
                `SELECT
                    id,
                    reference_code,
                    status,
                    amount,
                    currency,
                    metadata
                 FROM transactions
                 WHERE reference_code = $1
                 LIMIT 1`,
                [reference]
            );

            if (rows.length > 0) {
                const transaction = rows[0];

                if (transaction.status === 'Completed') {
                    const wallet = await db.query(
                        `SELECT balances
                         FROM wallets
                         WHERE user_id = $1
                         LIMIT 1`,
                        [user.id]
                    );

                    const balances =
                        typeof wallet.rows[0]?.balances === 'string'
                            ? JSON.parse(wallet.rows[0].balances)
                            : (wallet.rows[0]?.balances || {});

                    return NextResponse.json({
                        success: true,
                        status: 'Completed',
                        reference,
                        transactionId: transaction.id,
                        amount: Number(transaction.amount),
                        currency: transaction.currency,
                        operator,
                        newBalance: Number(balances[currency] || 0),
                    });
                }

                if (transaction.status === 'Failed') {
                    return NextResponse.json(
                        {
                            success: false,
                            status: 'Failed',
                            reference,
                            transactionId: transaction.id,
                            amount: Number(transaction.amount),
                            currency: transaction.currency,
                            operator,
                            error:
                                transaction.metadata?.failure_reason ||
                                'Le paiement Mobile Money a échoué.',
                        },
                        { status: 400 }
                    );
                }
            }

            await new Promise(resolve => setTimeout(resolve, POLL_MS));
        }

        /*
         * MaxiCash n'a pas encore envoyé la confirmation.
         * Le webhook continuera le traitement indépendamment.
         */
        return NextResponse.json({
            success: true,
            status: 'Pending',
            reference,
            amount,
            currency,
            operator,
            message: 'Demande envoyée. En attente de la confirmation MaxiCash.',
        });
    } catch (error: any) {
        console.error('[Deposit API] Error:', error);

        return NextResponse.json(
            {
                success: false,
                status: 'Failed',
                error: error?.message || 'Erreur lors du dépôt.',
            },
            { status: 500 }
        );
    }
}
