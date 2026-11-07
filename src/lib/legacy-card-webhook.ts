import crypto from 'crypto';

/** Separate trust boundary: legacy JIT callbacks must never fund FYATU v3 cards. */
export function verifyLegacyCardWebhook(payload: string, signature: string | null): boolean {
    const secret = process.env.MARQETA_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    const actual = Buffer.from(signature, 'utf8');
    const wanted = Buffer.from(expected, 'utf8');
    return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}
