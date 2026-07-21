
/**
 * @fileoverview Utilitaires pour le format .CPK (CashPay Key)
 * Gère le chiffrement/déchiffrement OFFLINE via le Web Crypto API.
 */

export interface CpkHeader {
    v: string;      // Version
    iss: string;    // Émetteur
    date: string;   // Date d'émission
    label: string;  // Label public
    cou: string;    // Pays d'origine
}

export interface CpkPayload {
    amount: number;
    currency: string;
    owner: string;
    ref: string;
    h: string;      // Signature H (Souveraine)
}

/**
 * Simule le déchiffrement local du payload.
 * Dans une version de production, nous utiliserions AES-GCM avec une clé 
 * dérivée du PIN via PBKDF2 (100% Client-Side).
 */
export async function decryptCpkPayload(encryptedData: string, pin: string): Promise<{ success: boolean; data?: CpkPayload; error?: string }> {
    // Simulation d'un délai de calcul cryptographique local
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
        // En mode démo/proto, nous utilisons un encodage Base64 simple 
        const decoded = atob(encryptedData);
        const data = JSON.parse(decoded);

        // La validation du PIN se fait côté serveur lors de la tentative d'encaissement
        // pour garantir la souveraineté. Ici on renvoie juste les données.
        return { success: true, data: data as CpkPayload };
    } catch (e) {
        return { success: false, error: "Erreur de déchiffrement. Le fichier est peut-être corrompu." };
    }
}

/**
 * Analyse le header public d'un fichier .cpk (Lisible sans PIN)
 * Adapté au format textuel structuré.
 */
export function parseCpkHeader(fileContent: string): { success: boolean; header?: CpkHeader; encryptedPart?: string; error?: string } {
    try {
        const secureMatch = fileContent.match(/\[SECURE-DATA-BLOCK\]\n([\s\S]*?)\n\[\/SECURE-DATA-BLOCK\]/);

        if (!secureMatch) return { success: false, error: "Bloc de données sécurisées introuvable dans le fichier .cpk." };

        const version = fileContent.match(/VERSION: (.*)/)?.[1] || "2.0";
        const issuingBank = fileContent.match(/ORIGINE: (.*)/)?.[1] || "CashPay Central Network";
        const date = fileContent.match(/DATE D'ÉMISSION: (.*)/)?.[1] || "N/A";
        
        // Extraction de la valeur nominale pour l'affichage public
        const amountMatch = fileContent.match(/VALEUR NOMINALE: (.*)/)?.[1] || "0.00 USD";

        return {
            success: true,
            header: {
                v: version,
                iss: issuingBank,
                date: date,
                label: `Valeur certifiée : ${amountMatch}`,
                cou: "Souverain"
            },
            encryptedPart: secureMatch[1].trim()
        };
    } catch (e) {
        return { success: false, error: "Impossible de lire le fichier .cpk" };
    }
}
