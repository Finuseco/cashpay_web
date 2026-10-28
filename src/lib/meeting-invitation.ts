export function invitationCode(content: string, metadata?: unknown): string | null {
    let data: any = metadata;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = null; } }
    const explicit = data?.meetCode || data?.meet_code;
    if (typeof explicit === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(explicit)) return explicit;
    const text = `${typeof data?.joinUrl === 'string' ? data.joinUrl : ''} ${content || ''}`;
    return /\/feedback\/meet\/([A-Za-z0-9_-]{4,64})(?=[\s?#/]|$)/.exec(text)?.[1] || null;
}
