import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { db } from '@/lib/db';
import { formatUser } from '@/lib/utils';
import { calculateTransactionFee } from '@/lib/actions/wallet.actions';

export async function POST(
    request: NextRequest,
    { params }: { params: { conversationId: string } }
) {
    let connection;

    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const conversationId = params.conversationId;

        if (!conversationId) {
            return NextResponse.json(
                { success: false, error: 'Conversation ID requis.' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const amount = Number(body.amount);
        const currency = String(body.currency || '').trim().toUpperCase();

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json(
                { success: false, error: 'Montant invalide.' },
                { status: 400 }
            );
        }

        if (!currency) {
            return NextResponse.json(
                { success: false, error: 'Devise requise.' },
                { status: 400 }
            );
        }

        connection = await db.getConnection();

        const { rows: participants } = await connection.query(
            `
            SELECT user_id
            FROM conversation_participants
            WHERE conversation_id = $1
            `,
            [conversationId]
        );

        const participantIds = participants.map(
            (row: { user_id: number }) => Number(row.user_id)
        );

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

        const { rows: userRows } = await connection.query(
            `
            SELECT *
            FROM users
            WHERE id = $1
            `,
            [user.id]
        );

        if (userRows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Utilisateur non trouvé.'
                },
                { status: 404 }
            );
        }

        const currentUser = formatUser(userRows[0]);

        const fee = await calculateTransactionFee(
            amount,
            currency,
            'TR',
            currentUser.country,
            connection
        );

        const totalDebit = amount + fee;

        return NextResponse.json({
            success: true,
            amount,
            currency,
            totalDebit
        });
    } catch (error) {
        console.error('[API ONCHAT TRANSFER QUOTE]', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Impossible de calculer le montant du transfert.'
            },
            { status: 500 }
        );
    } finally {
        if (connection) {
            connection.release();
        }
    }
}
