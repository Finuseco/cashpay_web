import type { Message } from '@/lib/types';

/**
 * Client des routes OnChat /api/v1/chat/conversations/[id] (les mêmes que l'application mobile).
 * L'utilisateur est identifié par le cookie de session côté serveur.
 */

function normalize(m: any): Message {
    return {
        id: String(m.id),
        senderId: Number(m.senderId),
        content: m.content ?? '',
        type: m.type,
        timestamp: m.timestamp ?? new Date().toISOString(),
        status: m.status,
        metadata: m.metadata == null ? undefined : typeof m.metadata === 'string' ? m.metadata : JSON.stringify(m.metadata),
        image_id: m.image_id ?? m.imageId ?? null,
    } as Message;
}

export async function sendChatMessage(
    conversationId: string,
    payload: { content: string; type: Message['type']; fileDataUri?: string; fileName?: string }
): Promise<Message> {
    const res = await fetch(`/api/v1/chat/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
        if (res.status === 413) throw new Error('Fichier trop volumineux.');
        throw new Error(data?.error || "Impossible d'envoyer le message.");
    }
    return normalize(data.message);
}

export async function fetchChatMessages(conversationId: string): Promise<Message[] | null> {
    try {
        const res = await fetch(`/api/v1/chat/conversations/${encodeURIComponent(conversationId)}`, {
            credentials: 'same-origin',
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.success) return null;
        return (data.conversation.messages as any[]).map(normalize);
    } catch {
        return null;
    }
}
