'use server';

import { db } from '@/lib/db';
import { formatUser } from '@/lib/utils';
import type { User } from '@/lib/types';


// A helper function to produce user-friendly DB error messages.
export async function handleDbError(error: unknown, context: string): Promise<{ error: string }> {
    console.error(`Database error during ${context}:`, error);
    
    // Check if the error object has a 'code' property, which is common for system errors.
    if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = (error as { code: string }).code;
        if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT') {
            // User-facing message is now generic.
            return { error: "Une erreur technique est survenue. Le service est peut-être en maintenance. Veuillez réessayer plus tard." };
        }
    }
    
    // Generic user-friendly error message to avoid exposing technical details.
    return { error: "Une erreur interne est survenue. Veuillez réessayer ou contacter le support si le problème persiste." };
};


// Helper to get a user from the DB. Can be extended.
export async function getUserFromDb(criteria: { walletId?: string; userId?: number; phoneNumber?: string; isAgent?: boolean }): Promise<User | null> {
  try {
    let query = 'SELECT * FROM users WHERE ';
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (criteria.userId) {
      query += `id = $${paramIndex++}`;
      params.push(criteria.userId);
    } else if (criteria.walletId) {
      query += `id_wallet = $${paramIndex++}`;
      params.push(criteria.walletId);
    } else if (criteria.phoneNumber) {
      query += `phone = $${paramIndex++}`;
      params.push(criteria.phoneNumber.replace('+', ''));
    }
    else if (criteria.isAgent) {
      // This is a simplified lookup for a generic agent. A real app would get the specific authenticated agent.
      query += 'role = \'Agent\' LIMIT 1';
    } else {
      return null;
    }

    const { rows } = await db.query(query, params);
    if (rows.length > 0) {
      return formatUser(rows[0]);
    }
    return null;
  } catch (error) {
    await handleDbError(error, `fetching user with criteria: ${JSON.stringify(criteria)}`);
    return null;
  }
}


/**
 * Saves a base64 encoded file to the filesystem and returns its public path.
 * This version is optimized to handle memory more efficiently by processing the buffer directly.
 * @param base64Data The base64 data URI of the file.
 * @param subfolder The subfolder path within public/images (e.g., 'avatars', 'jojo/produits').
 * @param baseName A base name for the file (e.g., user's ID or wallet ID).
 * @returns The public path to the saved file (e.g., '/images/avatars/avatar_123.png').
 */
export async function saveBase64Image(base64Data: string | null | undefined, subfolder: string, baseName: string): Promise<string | null> {
    if (!base64Data || !base64Data.startsWith('data:')) {
        return null;
    }
    
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
        const matches = base64Data.match(/^data:(image|video|application)\/([A-Za-z-+.\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 4) {
            console.error('Invalid base64 data format.');
            return null;
        }

        const mimeType = matches[2];
        const dataStr = matches[3];
        
        const buffer = Buffer.from(dataStr, 'base64');
        
        let extension;
        if (mimeType.includes('png')) extension = 'png';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
        else if (mimeType.includes('gif')) extension = 'gif';
        else if (mimeType.includes('webm')) extension = 'webm';
        else if (mimeType.includes('mp4')) extension = 'mp4';
        else if (mimeType.includes('pdf')) extension = 'pdf';
        else extension = mimeType.split('/')[1] || 'bin';

        // Ensure subfolder parts are safe
        const safeSubfolder = subfolder.split('/').map(part => part.replace(/[^a-z0-9_]/gi, '_')).join('/');
        const safeBaseName = baseName.replace(/[^a-z0-9_]/gi, '_');
        const fileName = `${safeBaseName}.${extension}`;
        
        const directoryPath = path.join(process.cwd(), 'public', 'images', safeSubfolder);
        await fs.mkdir(directoryPath, { recursive: true });

        const filePath = path.join(directoryPath, fileName);
        await fs.writeFile(filePath, buffer);

        return `/images/${safeSubfolder}/${fileName}`;

    } catch (error) {
        console.error('Failed to save base64 image:', error);
        return null;
    }
}
