import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

const VALID_DIRECTIONS = new Set([
    'incoming',
    'outgoing',
]);

function parseDate(value: string | null) {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

export async function GET(request: NextRequest) {
    try {
        const user =
            await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Authentification requise.',
                },
                { status: 401 }
            );
        }

        const userId =
            Number(user.id);

        if (
            !Number.isInteger(userId) ||
            userId <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Utilisateur authentifié invalide.',
                },
                { status: 401 }
            );
        }

        const searchParams =
            request.nextUrl.searchParams;

        const limitParam =
            searchParams.get('limit');

        const offsetParam =
            searchParams.get('offset');

        const fromParam =
            searchParams.get('from');

        const toParam =
            searchParams.get('to');

        const directionParam =
            searchParams.get('direction');

        const limitValue =
            Number(limitParam || 50);

        const offsetValue =
            Number(offsetParam || 0);

        if (
            !Number.isInteger(limitValue) ||
            limitValue < 1
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'limit invalide.',
                },
                { status: 400 }
            );
        }

        if (
            !Number.isInteger(offsetValue) ||
            offsetValue < 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'offset invalide.',
                },
                { status: 400 }
            );
        }

        const limit =
            Math.min(
                limitValue,
                100
            );

        const offset =
            offsetValue;

        if (
            directionParam &&
            !VALID_DIRECTIONS.has(
                directionParam
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'direction invalide. Utilisez incoming ou outgoing.',
                },
                { status: 400 }
            );
        }

        const fromDate =
            parseDate(fromParam);

        const toDate =
            parseDate(toParam);

        if (
            fromParam &&
            !fromDate
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Date from invalide.',
                },
                { status: 400 }
            );
        }

        if (
            toParam &&
            !toDate
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'Date to invalide.',
                },
                { status: 400 }
            );
        }

        if (
            fromDate &&
            toDate &&
            fromDate > toDate
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        'La date from doit être antérieure ou égale à la date to.',
                },
                { status: 400 }
            );
        }

        const conditions: string[] = [
            '(t.sender_id = $1 OR t.receiver_id = $1)',
        ];

        const values: unknown[] = [
            userId,
        ];

        if (
            directionParam ===
            'incoming'
        ) {
            conditions.push(
                't.receiver_id = $1'
            );
        }

        if (
            directionParam ===
            'outgoing'
        ) {
            conditions.push(
                't.sender_id = $1'
            );
        }

        if (fromDate) {
            values.push(fromDate);

            conditions.push(
                `t.created_at >= $${values.length}`
            );
        }

        if (toDate) {
            values.push(toDate);

            conditions.push(
                `t.created_at <= $${values.length}`
            );
        }

        const limitIndex =
            values.length + 1;

        const offsetIndex =
            values.length + 2;

        values.push(
            limit,
            offset
        );

        const query = `
            SELECT
                t.id,
                t.reference_code,
                t.type_code,
                t.status,
                t.amount,
                t.currency,
                t.fee,
                t.description,
                t.sender_id,
                t.receiver_id,
                t.sender_wallet_id,
                t.receiver_wallet_id,
                t.metadata,
                t.created_at,
                sender.full_name AS sender_full_name,
                sender.profile_photo AS sender_profile_photo,
                receiver.full_name AS receiver_full_name,
                receiver.profile_photo AS receiver_profile_photo
            FROM transactions t
            LEFT JOIN users sender
                ON sender.id = t.sender_id
            LEFT JOIN users receiver
                ON receiver.id = t.receiver_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY
                t.created_at DESC,
                t.id DESC
            LIMIT $${limitIndex}
            OFFSET $${offsetIndex}
        `;

        const { rows } =
            await db.query(
                query,
                values
            );

        const transactions =
            rows.map(
                (transaction) => {
                    const isSender =
                        Number(
                            transaction.sender_id
                        ) === userId;

                    const hasOtherUser =
                        isSender
                            ? Boolean(
                                  transaction.receiver_id
                              )
                            : Boolean(
                                  transaction.sender_id
                              );

                    const otherUser =
                        hasOtherUser
                            ? isSender
                                ? {
                                      userId:
                                          transaction.receiver_id,
                                      walletId:
                                          transaction.receiver_wallet_id,
                                      fullName:
                                          transaction.receiver_full_name,
                                      profilePhoto:
                                          transaction.receiver_profile_photo,
                                  }
                                : {
                                      userId:
                                          transaction.sender_id,
                                      walletId:
                                          transaction.sender_wallet_id,
                                      fullName:
                                          transaction.sender_full_name,
                                      profilePhoto:
                                          transaction.sender_profile_photo,
                                  }
                            : null;

                    const displayKind =
                        otherUser
                            ? 'person'
                            : 'service';

                    return {
                        id:
                            transaction.id,

                        reference:
                            transaction.reference_code,

                        type:
                            transaction.type_code,

                        status:
                            transaction.status,

                        direction:
                            isSender
                                ? 'outgoing'
                                : 'incoming',

                        amount:
                            transaction.amount,

                        currency:
                            transaction.currency,

                        fee:
                            transaction.fee,

                        description:
                            transaction.description,

                        sender: {
                            userId:
                                transaction.sender_id,
                            walletId:
                                transaction.sender_wallet_id,
                            fullName:
                                transaction.sender_full_name,
                            profilePhoto:
                                transaction.sender_profile_photo,
                        },

                        receiver: {
                            userId:
                                transaction.receiver_id,
                            walletId:
                                transaction.receiver_wallet_id,
                            fullName:
                                transaction.receiver_full_name,
                            profilePhoto:
                                transaction.receiver_profile_photo,
                        },

                        otherUser,

                        display: {
                            kind:
                                displayKind,

                            name:
                                otherUser?.fullName ||
                                transaction.description ||
                                transaction.type_code,

                            avatar:
                                otherUser?.profilePhoto ||
                                null,

                            icon:
                                otherUser
                                    ? null
                                    : transaction.type_code,
                        },

                        metadata:
                            transaction.metadata,

                        createdAt:
                            transaction.created_at,
                    };
                }
            );

        return NextResponse.json({
            success: true,

            userId,

            filters: {
                from:
                    fromDate
                        ? fromDate.toISOString()
                        : null,

                to:
                    toDate
                        ? toDate.toISOString()
                        : null,

                direction:
                    directionParam || null,
            },

            count:
                transactions.length,

            limit,

            offset,

            transactions,
        });
    } catch (error) {
        console.error(
            '[API V1 TRANSACTIONS GET]',
            error
        );

        return NextResponse.json(
            {
                success: false,
                error:
                    'Impossible de récupérer les transactions.',
            },
            { status: 500 }
        );
    }
}
