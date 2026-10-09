'use server';

import { createStatus, getStatusesForUser } from '@/lib/actions/status.actions';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { z } from 'zod';

const statusSchema = z.object({
    type: z.enum(['text', 'image', 'video']),
    content: z.string().min(1),
    backgroundColor: z.string().optional(),
});

export async function GET() {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return Response.json(
                { success: false, error: 'Authentification requise' },
                { status: 401 }
            );
        }

        const statusGroups = await getStatusesForUser(user.id);

        return Response.json({
            success: true,
            statusGroups,
        });
    } catch (error) {
        console.error('GET /api/onchat/statuses error:', error);

        return Response.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return Response.json(
                { success: false, error: 'Authentification requise' },
                { status: 401 }
            );
        }

        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();

            const type = formData.get('type');
            const backgroundColor = formData.get('backgroundColor');
            const file = formData.get('file');

            if (type !== 'image' && type !== 'video') {
                return Response.json(
                    { success: false, error: 'Type de statut invalide' },
                    { status: 400 }
                );
            }

            if (!(file instanceof File)) {
                return Response.json(
                    { success: false, error: 'Fichier requis' },
                    { status: 400 }
                );
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            const base64 = buffer.toString('base64');
            const content = `data:${file.type};base64,${base64}`;

            const result = await createStatus({
                userId: user.id,
                type,
                content,
                backgroundColor:
                    typeof backgroundColor === 'string'
                        ? backgroundColor
                        : undefined,
            });

            return Response.json(result);
        }

        if (contentType.includes('application/json')) {
            const body = await request.json();
            const parsed = statusSchema.safeParse(body);

            if (!parsed.success) {
                return Response.json(
                    {
                        success: false,
                        error: 'Données de statut invalides',
                        details: parsed.error.flatten(),
                    },
                    { status: 400 }
                );
            }

            const result = await createStatus({
                userId: user.id,
                type: parsed.data.type,
                content: parsed.data.content,
                backgroundColor: parsed.data.backgroundColor,
            });

            return Response.json(result);
        }

        return Response.json(
            { success: false, error: 'Content-Type non supporté' },
            { status: 415 }
        );
    } catch (error) {
        console.error('POST /api/onchat/statuses error:', error);

        return Response.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
