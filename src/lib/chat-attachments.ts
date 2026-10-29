import path from 'path';

// Explicit MIME allowlist; client filenames never determine executable extensions.
export const CHAT_MIME_EXTENSIONS: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
    'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/mpeg': '.mp3',
    'audio/aac': '.aac', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/webm': '.webm',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-matroska': '.mkv',
    'application/pdf': '.pdf', 'text/plain': '.txt', 'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};

export function attachmentLimit(mime: string): number {
    return (mime.startsWith('video/') ? 200 : 25) * 1024 * 1024;
}

export function ownedAttachmentPath(value: string, senderId: number): string | null {
    // Only references returned by the authenticated chat upload are accepted.
    let pathname: string;
    try {
        const base = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://app.cashpay-all.com');
        const url = new URL(value, base);
        if (url.origin !== base.origin || url.search || url.hash) return null;
        pathname = url.pathname;
    } catch { return null; }
    const prefix = `/api/uploads/onchat/${senderId}/`;
    if (!pathname.startsWith(prefix)) return null;
    const name = pathname.slice(prefix.length);
    return /^[a-f0-9-]{36}\.[a-z0-9]+$/.test(name) ? pathname : null;
}

export function attachmentDiskPath(userId: string, name: string): string {
    return path.join(process.cwd(), 'storage', 'onchat', userId, name);
}

export function parseChatDataUri(value: string): { mime: string; buffer: Buffer; extension: string } {
    const match = /^data:([^;,]+)(?:;[a-zA-Z0-9-]+=[^;,]*)*;base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
    const mime = match?.[1].toLowerCase();
    if (!match || !mime || !CHAT_MIME_EXTENSIONS[mime]) throw new Error('Format de fichier non autorisé.');
    if (match[2].length > Math.ceil(attachmentLimit(mime) / 3) * 4) throw new Error('Fichier trop volumineux.');
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length || buffer.length > attachmentLimit(mime)) throw new Error('Taille de fichier invalide.');
    return { mime, buffer, extension: CHAT_MIME_EXTENSIONS[mime] };
}
