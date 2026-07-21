
import crypto from 'crypto';

/**
 * Encrypts data using RSA with OAEP padding.
 * @param data The data to encrypt (must be a string).
 * @param publicKey The PEM-formatted public key.
 * @returns The encrypted data as a base64 string.
 */
export function encryptWithPublicKey(data: string, publicKey: string): string {
    try {
        const bufferToEncrypt = Buffer.from(data);
        const fullPublicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

        const encryptedBuffer = crypto.publicEncrypt(
            {
                key: fullPublicKey,
                padding: crypto.constants.RSA_PKCS1_PADDING, // M-Pesa docs often imply PKCS1 padding
            },
            bufferToEncrypt
        );
        return encryptedBuffer.toString('base64');
    } catch (error) {
        console.error("Encryption failed:", error);
        throw new Error("Failed to encrypt data.");
    }
}
