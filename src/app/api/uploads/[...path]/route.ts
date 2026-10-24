import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Sert les fichiers écrits dans /public APRÈS le démarrage du serveur (images, audios, documents du chat,
 * MonPays…). Next.js en production ne connaît que les fichiers présents au build : sans cette route,
 * un fichier téléversé n'est visible qu'après un nouveau build.
 * Atteinte via des réécritures « fallback » (next.config.js) : /images/x → /api/uploads/images/x,
 * donc le premier segment est la racine (images | uploads).
 */
export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    webm: 'audio/webm', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
    mp4: 'video/mp4', pdf: 'application/pdf', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const ALLOWED_ROOTS = ['images', 'uploads'];

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
    const [root, ...rest] = params.path || [];
    if (!root || !ALLOWED_ROOTS.includes(root) || rest.length === 0) {
        return new NextResponse('Introuvable', { status: 404 });
    }

    const base = path.join(process.cwd(), 'public', root);
    const target = path.normalize(path.join(base, ...rest));
    if (!target.startsWith(base + path.sep)) return new NextResponse('Introuvable', { status: 404 }); // anti path-traversal

    const ext = path.extname(target).slice(1).toLowerCase();
    const type = TYPES[ext];
    if (!type) return new NextResponse('Type non autorisé', { status: 415 });

    let data: Buffer;
    try {
        data = await fs.readFile(target);
    } catch {
        return new NextResponse('Introuvable', { status: 404 });
    }

    // Support minimal des requêtes Range (lecture audio/vidéo dans le navigateur).
    const range = request.headers.get('range');
    const m = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
    if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? Math.min(parseInt(m[2], 10), data.length - 1) : data.length - 1;
        if (start <= end && start < data.length) {
            return new NextResponse(data.subarray(start, end + 1), {
                status: 206,
                headers: {
                    'Content-Type': type,
                    'Content-Range': `bytes ${start}-${end}/${data.length}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': String(end - start + 1),
                },
            });
        }
    }

    return new NextResponse(data, {
        headers: {
            'Content-Type': type,
            'Content-Length': String(data.length),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
