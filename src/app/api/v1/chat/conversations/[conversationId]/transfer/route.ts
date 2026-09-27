import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { createInChatTransfer } from '@/lib/actions/message.actions';

export async function POST(
    request: NextRequest,
    { params }: { params: { conversationId: string } }
) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Unauthorized'
                },
                { status: 401 }
            );
        }

        const conversationId = params.conversationId;

        if (!conversationId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Conversation ID requis.'
                },
                { status: 400 }
            );
        }

        const body = await request.json();

        const amount = Number(body.amount);
        const currency = String(body.currency || '').trim().toUpperCase();
        const pin = String(body.pin || '');

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Montant invalide.'
                },
                { status: 400 }
            );
        }

        if (!currency) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Devise requise.'
                },
                { status: 400 }
            );
        }

        if (!pin) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Code PIN requis.'
                },
                { status: 400 }
            );
        }

        const { db } = await import('@/lib/db');

        const { rows: participants } = await db.query(
            `
            SELECT user_id
            FROM conversation_participants
            WHERE conversation_id = $1
            ORDER BY user_id
            `,
            [conversationId]
        );

        const participantIds = participants.map(
            (row: { user_id: number }) => Number(row.user_id)
        );

        if (participantIds.length !== 2) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Le transfert est disponible uniquement dans une conversation entre deux utilisateurs.'
                },
                { status: 400 }
            );
        }

        if (!participantIds.includes(user.id)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Accès refusé à cette conversation.'
                },
                { status: 403 }
            );
        }

        const receiverId = participantIds.find(
            (participantId: number) => participantId !== user.id
        );

        if (!receiverId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Destinataire introuvable dans cette conversation.'
                },
                { status: 400 }
            );
        }

        const result = await createInChatTransfer({
            conversationId,
            senderId: user.id,
            receiverId,
            amount,
            currency,
            pin
        });

        if (!result.success) {
            if (result.code === 'INSUFFICIENT_BALANCE') {
                return NextResponse.json(
                    {
                        success: false,
                        code: 'INSUFFICIENT_BALANCE',
                        balance: result.balance,
                        required: result.required,
                        currency: result.currency
                    },
                    { status: 422 }
                );
            }

            return NextResponse.json(
                {
                    success: false,
                    error: result.error || 'Le transfert a échoué.'
                },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            conversationId,
            receiverId,
            transaction: result.transaction,
            message: result.message
        });
    } catch (error) {
        console.error('[API ONCHAT TRANSFER]', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Erreur interne lors du transfert.'
            },
            { status: 500 }
        );
    }
}
