'use server';
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDbError = handleDbError;
exports.getUserFromDb = getUserFromDb;
exports.saveBase64Image = saveBase64Image;
const db_1 = require("@/lib/db");
const utils_1 = require("@/lib/utils");
// A helper function to produce user-friendly DB error messages.
async function handleDbError(error, context) {
    console.error(`Database error during ${context}:`, error);
    // Check if the error object has a 'code' property, which is common for system errors.
    if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = error.code;
        if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT') {
            // User-facing message is now generic.
            return { error: "Une erreur technique est survenue. Le service est peut-être en maintenance. Veuillez réessayer plus tard." };
        }
    }
    // Generic user-friendly error message to avoid exposing technical details.
    return { error: "Une erreur interne est survenue. Veuillez réessayer ou contacter le support si le problème persiste." };
}
;
// Helper to get a user from the DB. Can be extended.
async function getUserFromDb(criteria) {
    try {
        let query = 'SELECT * FROM users WHERE ';
        const params = [];
        let paramIndex = 1;
        if (criteria.userId) {
            query += `id = $${paramIndex++}`;
            params.push(criteria.userId);
        }
        else if (criteria.walletId) {
            query += `id_wallet = $${paramIndex++}`;
            params.push(criteria.walletId);
        }
        else if (criteria.phoneNumber) {
            query += `phone = $${paramIndex++}`;
            params.push(criteria.phoneNumber.replace('+', ''));
        }
        else if (criteria.isAgent) {
            // This is a simplified lookup for a generic agent. A real app would get the specific authenticated agent.
            query += 'role = \'Agent\' LIMIT 1';
        }
        else {
            return null;
        }
        const { rows } = await db_1.db.query(query, params);
        if (rows.length > 0) {
            return (0, utils_1.formatUser)(rows[0]);
        }
        return null;
    }
    catch (error) {
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
async function saveBase64Image(base64Data, subfolder, baseName) {
    if (!base64Data || !base64Data.startsWith('data:')) {
        return null;
    }
    const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
    const path = await Promise.resolve().then(() => __importStar(require('path')));
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
        if (mimeType.includes('png'))
            extension = 'png';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg'))
            extension = 'jpg';
        else if (mimeType.includes('gif'))
            extension = 'gif';
        else if (mimeType.includes('webm'))
            extension = 'webm';
        else if (mimeType.includes('mp4'))
            extension = 'mp4';
        else if (mimeType.includes('pdf'))
            extension = 'pdf';
        else
            extension = mimeType.split('/')[1] || 'bin';
        // Ensure subfolder parts are safe
        const safeSubfolder = subfolder.split('/').map(part => part.replace(/[^a-z0-9_]/gi, '_')).join('/');
        const safeBaseName = baseName.replace(/[^a-z0-9_]/gi, '_');
        const fileName = `${safeBaseName}.${extension}`;
        const directoryPath = path.join(process.cwd(), 'public', 'images', safeSubfolder);
        await fs.mkdir(directoryPath, { recursive: true });
        const filePath = path.join(directoryPath, fileName);
        await fs.writeFile(filePath, buffer);
        return `/images/${safeSubfolder}/${fileName}`;
    }
    catch (error) {
        console.error('Failed to save base64 image:', error);
        return null;
    }
}
