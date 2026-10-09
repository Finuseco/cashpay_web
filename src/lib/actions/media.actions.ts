'use server';

import fs from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { handleDbError } from './helpers';

function getLocalFilePath(filePath: string | null): string | null {
    if (!filePath || typeof filePath !== 'string') {
        return null;
    }

    if (!filePath.startsWith('/')) {
        return null;
    }

    const relativePath = filePath.replace(/^\/+/, '');

    if (
        relativePath.includes('..') ||
        path.isAbsolute(relativePath)
    ) {
        return null;
    }

    return path.join(process.cwd(), 'public', relativePath);
}

export async function deleteExpiredMedia(): Promise<{
    success: boolean;
    deleted: number;
    filesDeleted: number;
    error?: string;
}> {
    try {
        const { rows } = await db.query(
            `
            SELECT
                id,
                file_path
            FROM media
            WHERE expires_at IS NOT NULL
              AND expires_at <= NOW()
            `
        );

        if (rows.length === 0) {
            return {
                success: true,
                deleted: 0,
                filesDeleted: 0
            };
        }

        let filesDeleted = 0;
        const mediaIds: number[] = [];

        for (const media of rows) {
            mediaIds.push(Number(media.id));

            const localFilePath = getLocalFilePath(
                media.file_path
            );

            if (!localFilePath) {
                continue;
            }

            try {
                await fs.unlink(localFilePath);
                filesDeleted++;
            } catch (error: any) {
                if (error?.code !== 'ENOENT') {
                    console.error(
                        `[Media Cleanup] Impossible de supprimer ${localFilePath}`,
                        error
                    );
                }
            }
        }

        await db.query(
            `
            DELETE FROM media
            WHERE id = ANY($1::int[])
            `,
            [mediaIds]
        );

        console.log(
            `[Media Cleanup] Deleted ${mediaIds.length} expired media, ${filesDeleted} files.`
        );

        return {
            success: true,
            deleted: mediaIds.length,
            filesDeleted
        };
    } catch (error) {
        const dbError = await handleDbError(
            error,
            'deleting expired media'
        );

        return {
            success: false,
            deleted: 0,
            filesDeleted: 0,
            error: dbError.error
        };
    }
}
