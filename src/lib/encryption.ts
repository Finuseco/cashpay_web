
import crypto from 'crypto';

/**
 * @fileoverview Utilitaires de chiffrement pour les données sensibles (Secrets API, etc.)
 * Utilise AES-256-GCM pour garantir l'intégrité et la confidentialité.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

// Utilise la clé secrète du JWT comme base pour le chiffrement DB si aucune clé maître n'est définie
const MASTER_KEY = process.env.DB_ENCRYPTION_KEY || process.env.JWT_SECRET || 'cp_default_master_secure_key_32_bytes_';

/**
 * Chiffre une chaîne de caractères (ex: API Secret).
 */
export function encryptSecret(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = crypto.pbkdf2Sync(MASTER_KEY, salt, ITERATIONS, KEY_LENGTH, 'sha512');
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

/**
 * Déchiffre une chaîne de caractères.
 */
export function decryptSecret(cipherText: string): string {
    const data = Buffer.from(cipherText, 'base64');
    
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    const key = crypto.pbkdf2Sync(MASTER_KEY, salt, ITERATIONS, KEY_LENGTH, 'sha512');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Encrypts data using RSA with PKCS1 padding (Fallback legacy).
 */
export function encryptWithPublicKey(data: string, publicKey: string): string {
    try {
        const bufferToEncrypt = Buffer.from(data);
        const fullPublicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

        const encryptedBuffer = crypto.publicEncrypt(
            {
                key: fullPublicKey,
                padding: crypto.constants.RSA_PKCS1_PADDING,
            },
            bufferToEncrypt
        );
        return encryptedBuffer.toString('base64');
    } catch (error) {
        console.error("Encryption failed:", error);
        throw new Error("Failed to encrypt data.");
    }
}
