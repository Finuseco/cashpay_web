"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
exports.encryptWithPublicKey = encryptWithPublicKey;
const crypto_1 = __importDefault(require("crypto"));
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
function encryptSecret(text) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const salt = crypto_1.default.randomBytes(SALT_LENGTH);
    const key = crypto_1.default.pbkdf2Sync(MASTER_KEY, salt, ITERATIONS, KEY_LENGTH, 'sha512');
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}
/**
 * Déchiffre une chaîne de caractères.
 */
function decryptSecret(cipherText) {
    const data = Buffer.from(cipherText, 'base64');
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const key = crypto_1.default.pbkdf2Sync(MASTER_KEY, salt, ITERATIONS, KEY_LENGTH, 'sha512');
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
}
/**
 * Encrypts data using RSA with PKCS1 padding (Fallback legacy).
 */
function encryptWithPublicKey(data, publicKey) {
    try {
        const bufferToEncrypt = Buffer.from(data);
        const fullPublicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
        const encryptedBuffer = crypto_1.default.publicEncrypt({
            key: fullPublicKey,
            padding: crypto_1.default.constants.RSA_PKCS1_PADDING,
        }, bufferToEncrypt);
        return encryptedBuffer.toString('base64');
    }
    catch (error) {
        console.error("Encryption failed:", error);
        throw new Error("Failed to encrypt data.");
    }
}
