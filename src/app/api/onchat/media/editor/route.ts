import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
export const runtime = 'nodejs';
const requestSchema = z.object({ prompt: z.string().trim().min(1).max(2000), durationSeconds: z.number().positive().max(600), audioDataUri: z.string().max(28_000_000).regex(/^data:audio\/(?:mp4|aac|mpeg|wav);base64,[A-Za-z0-9+/=]+$/).optional() });
const outputSchema = z.object({ filter: z.enum(['Normal', 'Cinema', 'Sepia', 'Cyber Neon', 'Noir & Blanc', 'Vibrant']), speed: z.number().min(0.5).max(2), voiceVolume: z.number().min(0).max(2), caption: z.string().max(300), subtitles: z.array(z.object({ start: z.number().min(0), end: z.number().positive(), text: z.string().max(160) })).max(300) });
export async function POST(request: NextRequest) {
    if (!await getAuthenticatedUser()) return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ success: false, error: 'Jimmy est indisponible : service IA non configuré.' }, { status: 503 });
    if (Number(request.headers.get('content-length') || 0) > 29_000_000) return NextResponse.json({ success: false, error: 'Audio trop volumineux.' }, { status: 413 });
    try {
        const parsed = requestSchema.safeParse(await request.json());
        if (!parsed.success) return NextResponse.json({ success: false, error: 'Instruction, durée ou audio invalide.' }, { status: 400 });
        const { prompt, durationSeconds, audioDataUri } = parsed.data;
        const { output } = await ai.generate({
            model: process.env.ONCHAT_EDITOR_MODEL || 'googleai/gemini-2.5-flash',
            prompt: [{ text: `Tu es Jimmy, assistant de montage OnChat. Propose des réglages réellement applicables au moteur local. Durée source ${durationSeconds}s. Instruction utilisateur : ${prompt}. Retourne une légende seulement si demandée. Sous-titres : transcris exactement la parole de l'audio fourni avec début/fin en secondes dans la source. Ne fabrique jamais de paroles. Sans audio, retourne subtitles vide. Choisis speed=1 si des sous-titres sont demandés. Pas de fausses affirmations de traitements déjà effectués.` }, ...(audioDataUri ? [{ media: { url: audioDataUri } }] : [])],
            output: { schema: outputSchema },
        });
        const result = outputSchema.parse(output);
        result.subtitles = result.subtitles.filter(line => line.end > line.start && line.end <= durationSeconds && line.text.trim());
        return NextResponse.json({ success: true, plan: result });
    } catch (error) {
        console.error('[ONCHAT_EDITOR]', error instanceof Error ? error.message : 'AI failure');
        return NextResponse.json({ success: false, error: 'Jimmy n’a pas pu analyser cet audio ou cette instruction. Vos modifications manuelles sont conservées.' }, { status: 502 });
    }
}
