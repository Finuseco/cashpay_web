'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { StatusGroup } from '@/lib/types';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

type CreateStatusArgs = {
    userId: number;
    type: 'text' | 'image' | 'video';
    content: string;
    backgroundColor?: string;
};

export async function createStatus(
    args: CreateStatusArgs
): Promise<{
    success: boolean;
    error?: string;
    statusId?: number;
    content?: string;
    expiresAt?: string;
}> {
    const { userId, type, content, backgroundColor } = args;

    try {
        let finalContent = content;

        /*
         * Pour les médias reçus sous forme de data URL,
         * création d'un nom unique afin qu'un nouveau statut
         * ne puisse pas écraser le média d'un ancien statut.
         */
        if (
            (type === 'image' || type === 'video') &&
            content.startsWith('data:')
        ) {
            const match = content.match(
                /^data:((?:image|video)\/[^;]+);base64,([\s\S]+)$/
            );

            if (!match) {
                return {
                    success: false,
                    error: 'Invalid media data.'
                };
            }

            const mimeType = match[1];
            const data = match[2];

            let extension = mimeType.split('/')[1]?.toLowerCase() || 'bin';

            if (extension === 'jpeg') extension = 'jpg';

            const buffer = Buffer.from(data, 'base64');

            const uniqueName =
                `status_${userId}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${extension}`;

            const directoryPath = path.join(
                process.cwd(),
                'public',
                'images',
                'statuses'
            );

            await fs.mkdir(directoryPath, { recursive: true });

            const filePath = path.join(directoryPath, uniqueName);

            await fs.writeFile(filePath, buffer);

            /*
             * URL publique stockée dans statuses.content.
             * Le client recevra ensuite cette URL HTTPS.
             */
            finalContent =
                `/images/statuses/${uniqueName}`;
        }

        const expiresAt = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );

        const result = await db.query(
            `
            INSERT INTO statuses
                (user_id, type, content, background_color, expires_at)
            VALUES
                ($1, $2, $3, $4, $5)
            RETURNING id, content, expires_at
            `,
            [
                userId,
                type,
                finalContent,
                backgroundColor ?? null,
                expiresAt
            ]
        );

        const created = result.rows[0];

        return {
            success: true,
            statusId: created.id,
            content: created.content,
            expiresAt: new Date(created.expires_at).toISOString()
        };
    } catch (error) {
        const dbError = await handleDbError(
            error,
            'creating status'
        );

        return {
            success: false,
            error: dbError.error
        };
    }
}

export async function getStatusesForUser(
    userId: number
): Promise<StatusGroup[]> {
    try {
        const { rows } = await db.query(
            `
            SELECT
                s.id,
                s.user_id,
                s.type,
                s.content,
                s.background_color,
                s.created_at,
                s.expires_at,
                (SELECT COUNT(*) FROM status_views v WHERE v.status_id = s.id) AS views_count,
                (SELECT COUNT(*) FROM status_likes l WHERE l.status_id = s.id) AS likes_count,
                u.full_name,
                u.profile_photo
            FROM statuses s
            JOIN users u
                ON s.user_id = u.id
            WHERE s.expires_at > NOW()
              AND s.user_id = $1
            ORDER BY s.created_at ASC
            `,
            [userId]
        );

        if (rows.length === 0) {
            return [];
        }

        const groupedByContact = rows.reduce(
            (acc, row) => {
                const contactId = row.user_id;

                if (!acc[contactId]) {
                    acc[contactId] = {
                        contact: {
                            id: row.user_id,
                            full_name: row.full_name,
                            profile_photo: row.profile_photo,
                        },
                        statuses: [],
                        hasUnseen: true,
                    };
                }

                acc[contactId].statuses.push({
                    id: row.id,
                    userId: row.user_id,
                    type: row.type,
                    content: row.content,
                    backgroundColor: row.background_color,
                    createdAt: new Date(
                        row.created_at
                    ).toISOString(),
                    expiresAt: new Date(row.expires_at).toISOString(),
                    viewsCount: Number(row.views_count || 0),
                    likesCount: Number(row.likes_count || 0),
                });

                return acc;
            },
            {} as Record<number, StatusGroup>
        );

        return Object.values(groupedByContact);
    } catch (error) {
        await handleDbError(
            error,
            'fetching statuses'
        );

        return [];
    }
}

export async function deleteExpiredStatuses(): Promise<void> {
    try {
        const { rows: expiredStatuses } =
            await db.query(
                `
                SELECT id, type, content
                FROM statuses
                WHERE expires_at <= NOW()
                `
            );

        if (expiredStatuses.length === 0) {
            return;
        }

        const fileDeletionPromises: Promise<any>[] = [];
        const statusIds: number[] = [];

        for (const status of expiredStatuses) {
            statusIds.push(status.id);

            if (
                (status.type === 'image' ||
                    status.type === 'video') &&
                typeof status.content === 'string' &&
                status.content.startsWith(
                    '/images/statuses/'
                )
            ) {
                const filePath = path.join(
                    process.cwd(),
                    'public',
                    status.content
                );

                fileDeletionPromises.push(
                    fs.unlink(filePath).catch(() => undefined)
                );
            }
        }

        await Promise.all(fileDeletionPromises);

        await db.query(
            `
            DELETE FROM statuses
            WHERE id = ANY($1::int[])
            `,
            [statusIds]
        );

        console.log(
            `[Status Cleanup] Deleted ${statusIds.length} expired statuses and their media.`
        );
    } catch (error) {
        await handleDbError(
            error,
            'deleting expired statuses'
        );
    }
}
