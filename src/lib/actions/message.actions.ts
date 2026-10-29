
'use server';

import type { Conversation, Message, User, AssistantSettings, Currency, GroupMessage, Product } from '@/lib/types';
import { generateChatResponse } from '@/ai/flows/chat-flow';
import { transcribeAudio } from '@/ai/flows/speech-to-text-flow';
import { db } from '@/lib/db';
import { handleDbError, saveBase64Image, getUserFromDb } from '@/lib/actions/helpers';
import { formatUser, generateReferenceCode } from '@/lib/utils';
import { createNotification } from '@/lib/actions/notification.actions';
import { textToSpeech } from '@/ai/flows/text-to-speech-flow';
import { sendEmail } from '@/services/email';
import { createTransaction } from '@/lib/actions/transaction.actions';
import { verifyCurrentUserPin } from '@/lib/actions/auth.actions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { parseChatDataUri, attachmentDiskPath, ownedAttachmentPath } from '@/lib/chat-attachments';

export async function getConversationsForUser(userId: number): Promise<Conversation[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                c.id as conversationId,
                u.*,
                (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as lastMessage,
                (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as lastMessageTimestamp,
                (SELECT COUNT(*) FROM messages msg WHERE msg.conversation_id = c.id AND msg.is_read = false AND msg.sender_id != $1) as unreadCount
            FROM conversation_participants cp
            JOIN conversations c ON cp.conversation_id = c.id
            JOIN conversation_participants other_cp ON c.id = other_cp.conversation_id AND other_cp.user_id != $1
            JOIN users u ON other_cp.user_id = u.id
            WHERE cp.user_id = $1
            GROUP BY c.id, u.id
            ORDER BY lastMessageTimestamp DESC;
        `, [userId]);

        return rows.map(row => {
            const formattedContact = formatUser(row);
            formattedContact.availabilityStatus = 'available';
            
            return {
                id: row.conversationid,
                userId: userId,
                contact: formattedContact,
                lastMessage: row.lastmessage || 'Démarrez la conversation',
                lastMessageTimestamp: new Date(row.lastmessagetimestamp || row.created_at || Date.now()).toISOString(),
                unreadCount: Number(row.unreadcount || 0),
                messages: [],
            };
        });
    } catch (error) {
        handleDbError(error, 'fetching conversations');
        return [];
    }
}


export async function getConversation(userId: number, contactId: number): Promise<Conversation | null> {
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const { rows: contactRows } = await connection.query(
            'SELECT * FROM users WHERE id = $1',
            [contactId]
        );

        if (contactRows.length === 0) {
            throw new Error('Contact user not found');
        }

        const contactUser = formatUser(contactRows[0]);

        const { rows: convRows } = await connection.query(
            `
            SELECT c.id
            FROM conversations c

            INNER JOIN conversation_participants cp1
                ON cp1.conversation_id = c.id
               AND cp1.user_id = $1

            INNER JOIN conversation_participants cp2
                ON cp2.conversation_id = c.id
               AND cp2.user_id = $2

            WHERE c.is_group = false

              AND (
                SELECT COUNT(*)
                FROM conversation_participants cp
                WHERE cp.conversation_id = c.id
              ) = 2

            ORDER BY c.created_at ASC
            LIMIT 1
            `,
            [userId, contactId]
        );

        let conversationId: string;
        let messages: any[] = [];

        if (convRows.length > 0) {
            conversationId = String(convRows[0].id);
        } else {
            conversationId = `conv_${Math.min(userId, contactId)}_${Math.max(userId, contactId)}`;

            await connection.query(
                `
                INSERT INTO conversations (id, is_group)
                VALUES ($1, false)
                ON CONFLICT (id) DO NOTHING
                `,
                [conversationId]
            );

            await connection.query(
                `
                INSERT INTO conversation_participants (
                    conversation_id,
                    user_id
                )
                VALUES
                    ($1, $2),
                    ($1, $3)
                ON CONFLICT (conversation_id, user_id) DO NOTHING
                `,
                [conversationId, userId, contactId]
            );
        }

        const { rows: messageRows } = await connection.query(
            `
            SELECT
                id,
                sender_id,
                content,
                type,
                status,
                metadata,
                image_id,
                is_read,
                created_at
            FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at ASC, id ASC
            `,
            [conversationId]
        );

        messages = messageRows;

        const unreadCount = messages.filter(
            (message) =>
                Number(message.sender_id) !== Number(userId) &&
                message.is_read === false
        ).length;

        const lastMessage =
            messages.length > 0
                ? messages[messages.length - 1]
                : null;

        const lastMessageTimestamp = lastMessage?.created_at
            ? new Date(lastMessage.created_at).toISOString()
            : new Date().toISOString();

        await connection.query('COMMIT');

        return {
            id: conversationId,
            userId: userId,
            contact: contactUser,

            messages: messages.map((message) => ({
                id: String(message.id),
                senderId: message.sender_id,
                content: message.content,
                timestamp: new Date(message.created_at).toISOString(),
                type: message.type,
                status: message.status,
                metadata:
                    typeof message.metadata === 'string'
                        ? message.metadata
                        : JSON.stringify(message.metadata),
                image_id: message.image_id,
            })),

            lastMessage: lastMessage
                ? lastMessage.content
                : 'Démarrez la conversation',

            lastMessageTimestamp,

            unreadCount,
        };
    } catch (error) {
        await connection.query('ROLLBACK');

        handleDbError(
            error,
            'getting or creating conversation'
        );

        return null;
    } finally {
        connection.release();
    }
}

export async function createConversationByWalletId(currentUserId: number, targetWalletId: string): Promise<{ success: boolean; error?: string; conversation?: Conversation | null }> {
    try {
        const { rows: targetUserRows } = await db.query('SELECT * FROM users WHERE id_wallet = $1', [targetWalletId]);
        if (targetUserRows.length === 0) {
            return { success: false, error: 'Utilisateur non trouvé.' };
        }
        const targetUser = formatUser(targetUserRows[0]);
        
        if (targetUser.id === currentUserId) {
            return { success: false, error: 'Vous ne pouvez pas démarrer une conversation avec vous-même.'};
        }

        const conversation = await getConversation(currentUserId, targetUser.id);
        if (conversation) {
            return { success: true, conversation };
        } else {
            return { success: false, error: "Impossible de créer la conversation." };
        }

    } catch (error) {
        const dbError = await handleDbError(error, 'creating conversation by wallet ID');
        return { success: false, error: dbError.error };
    }
}


export async function postMessage(
    conversationId: string,
    content: string,
    type: Message['type'],
    senderId: number,
    receiverId: number,
    fileDataUri?: string,
    fileName?: string,
    attachmentMetadata?: Record<string, unknown>
): Promise<Message> {
    const connection = await db.getConnection();

    try {
        await connection.query('BEGIN');

        const { rows: participantRows } = await connection.query(
            `
            SELECT user_id
            FROM conversation_participants
            WHERE conversation_id = $1
              AND user_id IN ($2, $3)
            ORDER BY user_id
            `,
            [conversationId, senderId, receiverId]
        );

        const participantIds = participantRows.map((row) => Number(row.user_id));

        if (!participantIds.includes(senderId)) {
            throw new Error('Expéditeur non autorisé pour cette conversation.');
        }

        if (!participantIds.includes(receiverId)) {
            throw new Error('Destinataire non autorisé pour cette conversation.');
        }

        const { rows: conversationRows } = await connection.query(
            `
            SELECT COUNT(*)::int AS count
            FROM conversation_participants
            WHERE conversation_id = $1
            `,
            [conversationId]
        );

        if (Number(conversationRows[0]?.count || 0) !== 2) {
            throw new Error('Conversation invalide.');
        }

        let imageId: string | null = null;
        let metadata: Record<string, unknown> | null = attachmentMetadata || null;

        if (attachmentMetadata?.fileUrl && (typeof attachmentMetadata.fileUrl !== 'string' || !ownedAttachmentPath(attachmentMetadata.fileUrl, senderId))) {
            throw new Error('Fichier non autorisé.');
        }
        if (fileDataUri) {
            const attachment = parseChatDataUri(fileDataUri);
            const name = `${crypto.randomUUID()}${attachment.extension}`;
            const target = attachmentDiskPath(String(senderId), name);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, attachment.buffer);
            if (type === 'image') imageId = `IMG_${crypto.randomBytes(16).toString('hex')}`;
            metadata = {
                ...metadata,
                fileUrl: `/api/uploads/onchat/${senderId}/${name}`,
                fileName: fileName || name,
                ...(imageId ? { imageId } : {}),
            };
        }

        const messageId = `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

        const { rows } = await connection.query(
            `
            INSERT INTO messages (
                id,
                conversation_id,
                sender_id,
                content,
                type,
                status,
                metadata,
                image_id,
                is_read
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
            RETURNING *
            `,
            [
                messageId,
                conversationId,
                senderId,
                content,
                type,
                'sent',
                metadata ? JSON.stringify(metadata) : null,
                imageId,
                false,
            ]
        );

        const insertedMessage = rows[0];

        // PostgreSQL delivers NOTIFY only after COMMIT; no uncommitted message is broadcast.
        await connection.query("SELECT pg_notify('onchat_messages', $1)", [JSON.stringify({ id: messageId })]);
        await connection.query('COMMIT');

        // Le message est déjà enregistré : une panne de notification/e-mail ne doit pas le faire échouer.
        try {
            const sender = await getUserFromDb({ userId: senderId });
            const receiver = await getUserFromDb({ userId: receiverId });

            if (receiver && sender) {
                let notificationText = content;

                if (type === 'image') notificationText = '📷 Photo';
                if (type === 'audio') notificationText = '🎤 Message vocal';
                if (type === 'doc') notificationText = '📄 Document';
                if (type === 'product') notificationText = '🛍️ Produit partagé';

                await createNotification(
                    receiverId,
                    `Nouveau message de ${sender.full_name || 'Quelqu’un'}`,
                    notificationText.substring(0, 100),
                    'new_message',
                    { contactId: senderId }
                );

                if (receiver.email) {
                    const senderProfilePicture = sender.profile_photo
                        ? `${process.env.NEXT_PUBLIC_APP_URL}${sender.profile_photo}`
                        : 'https://www.cashpay-all.com/logos/profile-placeholder.png';

                    await sendEmail(
                        receiver.email,
                        `Nouveau message de ${sender.full_name}`,
                        'new_message',
                        {
                            senderName: sender.full_name,
                            senderProfilePicture,
                            messageContent: notificationText,
                            timestamp: format(
                                new Date(),
                                "d MMMM yyyy 'à' HH:mm",
                                { locale: fr }
                            ),
                            replyLink:
                                `${process.env.NEXT_PUBLIC_APP_URL}/feedback?contactId=${senderId}`,
                        }
                    );
                }
            }
        } catch (notifyError) {
            console.error('[postMessage] notification', notifyError);
        }

        return {
            id: insertedMessage.id.toString(),
            senderId: insertedMessage.sender_id,
            content: insertedMessage.content,
            type: insertedMessage.type,
            timestamp: new Date(insertedMessage.created_at).toISOString(),
            status: insertedMessage.status,
            metadata:
                typeof insertedMessage.metadata === 'string'
                    ? insertedMessage.metadata
                    : JSON.stringify(insertedMessage.metadata),
            image_id: insertedMessage.image_id ?? null,
        };
    } catch (error) {
        await connection.query('ROLLBACK');
        handleDbError(error, 'posting message');
        throw error;
    } finally {
        connection.release();
    }
}

export async function forwardMessage(
    senderId: number,
    originalMessageId: string,
    targetType: 'conversation' | 'group',
    targetId: string | number
): Promise<{ success: boolean; error?: string }> {
    try {
        const { rows: msgRows } = await db.query('SELECT * FROM messages WHERE id = $1', [originalMessageId]);
        let originalMsg = msgRows[0];
        
        if (!originalMsg) {
            const { rows: groupMsgRows } = await db.query('SELECT * FROM group_messages WHERE id = $1', [originalMessageId]);
            if (groupMsgRows.length === 0) return { success: false, error: "Message original non trouvé." };
            originalMsg = groupMsgRows[0];
        }

        const metadataStr = typeof originalMsg.metadata === 'string' ? originalMsg.metadata : JSON.stringify(originalMsg.metadata);

        if (targetType === 'conversation') {
            await db.query(
                'INSERT INTO messages (conversation_id, sender_id, content, type, status, metadata, image_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [targetId, senderId, originalMsg.content, originalMsg.type, 'sent', metadataStr, originalMsg.image_id]
            );
        } else {
            await db.query(
                'INSERT INTO group_messages (group_id, sender_id, content, type, metadata, image_id) VALUES ($1, $2, $3, $4, $5, $6)',
                [targetId, senderId, originalMsg.content, originalMsg.type, metadataStr, originalMsg.image_id]
            );
        }

        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'forwarding message');
        return { success: false, error: dbError.error };
    }
}

export async function transcribeVoiceMessage(audioDataUri: string) {
    const result = await transcribeAudio({ audioDataUri });
    return result.transcription;
}


export async function getAiChatResponse(
  conversation: Conversation,
  assistantSettings?: AssistantSettings | null
): Promise<string> {
  const dayOfWeek = new Date().toLocaleString('en-US', { weekday: 'long' });
  const isAssistantActiveToday = assistantSettings?.isEnabled && assistantSettings.activeDays.includes(dayOfWeek);

  if (isAssistantActiveToday && assistantSettings.customMessage) {
    return assistantSettings.customMessage;
  }

  const historyForAi = conversation.messages
    .filter(m => m.content && m.content.trim() !== '' && m.type === 'text') 
    .map(m => ({
      role: m.senderId === conversation.userId ? ('user' as const) : ('model' as const),
      content: [{ text: m.content }],
    }));
  
  const systemPrompt = `You are ${conversation.contact.full_name}, a personal assistant. Respond naturally to the user's message in the context of the conversation history. Keep your responses concise and helpful. Use the getUserProfileInfo tool to answer any questions about your (the user you are representing) availability, schedule, contact information, or professional status. Do not guess this information; always use the tool. The user's language is likely French, but you should respond in whatever language they use.`;

  const aiResponse = await generateChatResponse({
    history: historyForAi,
    systemPrompt: systemPrompt
  });
  
  return aiResponse;
}


export async function getAiSpokenResponse(text: string): Promise<{ audioDataUri: string }> {
    const result = await textToSpeech(text);
    return { audioDataUri: result.audioDataUri };
}

export async function markConversationAsRead(conversationId: string, userId: number): Promise<void> {
    try {
        await db.query('UPDATE messages SET is_read = true, status = \'read\' WHERE conversation_id = $1 AND sender_id != $2', [conversationId, userId]);
    } catch(e) {
        await handleDbError(e, 'marking conversation as read');
    }
}

export async function deleteMessage(messageId: string): Promise<{ success: boolean, error?: string }> {
    try {
        await db.query('DELETE FROM messages WHERE id = $1', [messageId]);
        return { success: true };
    } catch(e) {
        const dbError = await handleDbError(e, 'deleting message');
        return { success: false, error: dbError.error };
    }
}

interface InChatTransferArgs {
    conversationId: string,
    senderId: number,
    receiverId: number,
    amount: number,
    currency: string,
    pin: string,
}

export async function createInChatTransfer(args: InChatTransferArgs): Promise<{
    success: boolean;
    conversation?: Conversation;
    message?: Message;
    transaction?: {
        id?: number;
        reference?: string;
        amount: number;
        currency: string;
        fee?: number;
        senderNewBalance?: number;
        receiverNewBalance?: number;
    };
    error?: string;
    code?: string;
    balance?: number;
    required?: number;
    currency?: string;
}> {
    const { conversationId, senderId, receiverId, amount, currency, pin } = args;

    try {
        if (!Number.isFinite(amount) || amount <= 0) {
            return {
                success: false,
                error: "Le montant du transfert doit être supérieur à zéro."
            };
        }

        if (!currency || typeof currency !== 'string') {
            return {
                success: false,
                error: "La devise du transfert est requise."
            };
        }

        /*
         * Vérification de la conversation.
         * Le destinataire doit obligatoirement être l'autre participant
         * de cette conversation.
         */
        const { rows: participantRows } = await db.query(`
            SELECT user_id
            FROM conversation_participants
            WHERE conversation_id = $1
              AND user_id IN ($2, $3)
            ORDER BY user_id
        `, [conversationId, senderId, receiverId]);

        const participantIds = participantRows.map(row => Number(row.user_id));

        if (
            participantIds.length !== 2 ||
            !participantIds.includes(senderId) ||
            !participantIds.includes(receiverId)
        ) {
            return {
                success: false,
                error: "Cette conversation n'autorise pas ce transfert."
            };
        }

        /*
         * Vérification du PIN CashPay.
         */
        const pinVerification = await verifyCurrentUserPin(pin);

        if (!pinVerification.success) {
            return {
                success: false,
                error: pinVerification.error || "Le code PIN est incorrect."
            };
        }

        /*
         * Récupération des utilisateurs.
         */
        const { rows: senderUserRows } = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [senderId]
        );

        if (senderUserRows.length === 0) {
            return {
                success: false,
                error: "Utilisateur expéditeur non trouvé."
            };
        }

        const { rows: receiverUserRows } = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [receiverId]
        );

        if (receiverUserRows.length === 0) {
            return {
                success: false,
                error: "Utilisateur destinataire non trouvé."
            };
        }

        const senderUser = formatUser(senderUserRows[0]);
        const receiverUser = formatUser(receiverUserRows[0]);

        /*
         * Le moteur financier CashPay reste la seule source
         * de vérité pour le débit, le crédit, les frais et
         * la création de la transaction.
         */
        const transactionResult = await createTransaction({
            user: senderUser,
            typeCode: 'TR',
            amount,
            currency: currency.toUpperCase(),
            description: `Transfert OnChat à ${receiverUser.full_name}`,
            receiver_id: receiverId,
            metadata: {
                onchat: true,
                conversation_id: conversationId,
                sender_id: senderId,
                receiver_id: receiverId
            }
        });

        if (!transactionResult.success) {
            const errorMessage =
                transactionResult.error ||
                "Le transfert n'a pas pu être effectué.";

            if (errorMessage.toLowerCase().includes("solde insuffisant")) {
                const match = errorMessage.match(
                    /Requis:\s*([0-9]+(?:\.[0-9]+)?)\s*\(incluant\s*([0-9]+(?:\.[0-9]+)?)\s*de frais\),\s*disponible:\s*([0-9]+(?:\.[0-9]+)?)/i
                );

                if (match) {
                    return {
                        success: false,
                        error: "Solde insuffisant.",
                        code: "INSUFFICIENT_BALANCE",
                        balance: Number(match[3]),
                        required: Number(match[1]),
                        currency: currency.toUpperCase()
                    };
                }
            }

            return {
                success: false,
                error: errorMessage
            };
        }

        /*
         * La transaction financière étant confirmée, on crée
         * maintenant le message financier dans LA MÊME conversation.
         */
        const transferMetadata = {
            onchat: true,
            conversationId,
            transactionId: transactionResult.transactionId ?? null,
            reference: transactionResult.reference ?? null,
            amount,
            currency: currency.toUpperCase(),
            fee: transactionResult.fee ?? 0,
            senderId,
            receiverId
        };

        const messageContent =
            `💸 Transfert de ${amount.toFixed(2)} ${currency.toUpperCase()}`;
        const messageId = `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;



        const { rows: messageRows } = await db.query(
            `
            INSERT INTO messages (
                id,
                conversation_id,
                sender_id,
                content,
                type,
                status,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
            RETURNING *
            `,
            [
                messageId,
                conversationId,
                senderId,
                messageContent,
                'in_chat_transfer',
                'sent',
                JSON.stringify(transferMetadata)
            ]
        );

        const insertedMessage = messageRows[0];

        const transferMessage: Message = {
            id: insertedMessage.id.toString(),
            senderId: insertedMessage.sender_id,
            content: insertedMessage.content,
            timestamp: new Date(insertedMessage.created_at).toISOString(),
            type: 'in_chat_transfer',
            status: insertedMessage.status,
            metadata:
                typeof insertedMessage.metadata === 'string'
                    ? insertedMessage.metadata
                    : JSON.stringify(insertedMessage.metadata),
            image_id: insertedMessage.image_id ?? null
        };

        /*
         * Recharge la conversation avec le nouveau message.
         */
        const updatedConversation = await getConversation(senderId, receiverId);

        return {
            success: true,
            conversation: updatedConversation || undefined,
            message: transferMessage,
            transaction: {
                id: transactionResult.transactionId,
                reference: transactionResult.reference,
                amount,
                currency: currency.toUpperCase(),
                fee: transactionResult.fee,
                senderNewBalance: transactionResult.senderNewBalance,
                receiverNewBalance: transactionResult.receiverNewBalance
            }
        };
    } catch (error: any) {
        console.error("[createInChatTransfer] Error:", error);

        return {
            success: false,
            error: error?.message || "Une erreur est survenue lors du transfert."
        };
    }
}

export async function getMessageById(messageId: string): Promise<Message | null> {
  try {
    const { rows } = await db.query('SELECT * FROM messages WHERE id = $1', [messageId]);
    if (rows.length === 0) {
      return null;
    }
    const m = rows[0];
    return {
      id: m.id.toString(),
      senderId: m.sender_id,
      content: m.content,
      timestamp: new Date(m.created_at).toISOString(),
      type: m.type,
      status: m.status,
      metadata: typeof m.metadata === 'string' ? m.metadata : JSON.stringify(m.metadata),
      image_id: m.image_id
    };
  } catch (error) {
    handleDbError(error, 'fetching message by id');
    return null;
  }
}

export async function updateMessage(messageId: string, content: string): Promise<{ success: boolean; error?: string; message?: Message }> {
    try {
        await db.query('UPDATE messages SET content = $1, status = \'edited\' WHERE id = $2', [content, messageId]);
        const updatedMessage = await getMessageById(messageId);
        return { success: true, message: updatedMessage || undefined };
    } catch(e) {
        const dbError = await handleDbError(e, 'updating message');
        return { success: false, error: dbError.error };
    }
}

export async function postGroupMessage(
    groupId: number,
    senderId: number,
    content: string,
    type: Message['type'] = 'text',
    fileDataUri?: string,
    fileName?: string,
    attachmentMetadata?: Record<string, string>
): Promise<Message> {
    const { getAuthenticatedUser } = await import('./user.actions');
    const user = await getAuthenticatedUser();
    if (!user || Number(user.id) !== Number(senderId)) throw new Error('Authentification requise.');
    const membership = await db.query("SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = 'active'", [groupId, user.id]);
    if (!membership.rows.length) throw new Error('Groupe inaccessible.');
    if (attachmentMetadata?.fileUrl && !ownedAttachmentPath(attachmentMetadata.fileUrl, user.id)) throw new Error('Fichier non autorisé.');
    let metadata = attachmentMetadata ? JSON.stringify(attachmentMetadata) : null;
    let imageId = null;
    if (fileDataUri) {
        const attachment = parseChatDataUri(fileDataUri);
        const name = `${crypto.randomUUID()}${attachment.extension}`;
        const target = attachmentDiskPath(String(user.id), name);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, attachment.buffer);
        if (type === 'image') imageId = `IMG_${crypto.randomBytes(16).toString('hex')}`;
        metadata = JSON.stringify({ fileUrl: `/api/uploads/onchat/${user.id}/${name}`, fileName: fileName || name, imageId });
    }

    const { rows } = await db.query('INSERT INTO group_messages (group_id, sender_id, content, type, metadata, image_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', 
        [groupId, senderId, content, type, metadata, imageId]);
    
    const insertedMessage = rows[0];
    await db.query("SELECT pg_notify('onchat_group_messages', $1)", [JSON.stringify({ id: String(insertedMessage.id) })]);


    const { rows: memberRows } = await db.query('SELECT user_id FROM group_members WHERE group_id = $1 AND user_id != $2', [groupId, senderId]);
    const memberIds = memberRows.map(r => r.user_id);
    const sender = await getUserFromDb({userId: senderId});
    const { rows: groupRows } = await db.query('SELECT name FROM groups WHERE id = $1', [groupId]);
    const groupName = groupRows.length > 0 ? groupRows[0].name : 'un groupe';

    for (const memberId of memberIds) {
        await createNotification(
            memberId,
            `Nouveau message dans ${groupName}`,
            `${sender?.full_name}: ${content.substring(0, 50)}...`,
            'new_message',
            { groupId: groupId }
        );
    }
    
    return {
        id: insertedMessage.id.toString(),
        senderId: insertedMessage.sender_id,
        content: insertedMessage.content,
        type: insertedMessage.type,
        timestamp: new Date(insertedMessage.created_at).toISOString(),
        status: 'sent',
        metadata: typeof insertedMessage.metadata === 'string' ? insertedMessage.metadata : JSON.stringify(insertedMessage.metadata),
        image_id: insertedMessage.image_id
    };
}

/**
 * Shares a JoJo product to a specific conversation or group.
 */
export async function shareProductToChat(args: {
    senderId: number;
    targetId: string | number;
    targetType: 'conversation' | 'group';
    product: Product;
}): Promise<{ success: boolean; error?: string }> {
    const { senderId, targetId, targetType, product } = args;
    
    try {
        const metadata = {
            productId: product.id,
            name: product.name,
            price: product.sellingPrice,
            currency: product.currency,
            image: product.image,
        };

        const metadataStr = JSON.stringify(metadata);

        if (targetType === 'conversation') {
            await db.query(
                'INSERT INTO messages (conversation_id, sender_id, content, type, status, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
                [targetId, senderId, `🛍️ Produit: ${product.name}`, 'product', 'sent', metadataStr]
            );
        } else {
            await db.query(
                'INSERT INTO group_messages (group_id, sender_id, content, type, metadata) VALUES ($1, $2, $3, $4, $5)',
                [targetId, senderId, `🛍️ Produit: ${product.name}`, 'product', metadataStr]
            );
        }

        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'sharing product to chat');
        return { success: false, error: dbError.error };
    }
}
