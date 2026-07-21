

'use server';

/**
 * @fileoverview A mock service for interacting with the Visa Developer Platform APIs.
 * This simulates the creation and activation of virtual cards, and dynamic CVV generation.
 */
import fs from 'fs/promises';
import path from 'path';

interface CreateCardArgs {
    userId: string;
    currency: string;
    pin: string;
}

interface VisaCard {
    id: string; // Visa's unique ID for the card
    pan: string;
    expiry: { month: number, year: number };
    cvv: string;
}

interface SecurityCodeResponse {
    success: boolean;
    securityCode?: string;
    error?: string;
}

interface FundingResponse {
    success: boolean;
    transactionId?: string;
    error?: string;
}

interface InAppProvisioningData {
    encryptedPassData: string;
    activationData: string;
    ephemeralPublicKey: string;
}

interface AccountUpdaterResponse {
    success: boolean;
    card?: {
        pan: string;
        expiryMonth: string;
        expiryYear: string;
    };
    error?: string;
}


const checkApiKey = (type: 'provisioning' | 'vpa' | 'bin'): boolean => {
    if (type === 'vpa') {
        const userId = process.env.VISA_VPA_API_USERID;
        const password = process.env.VISA_VPA_API_PASSWORD;
        if (!userId || !password || userId.includes('YOUR_VISA')) {
            console.error(`[Visa Service - ${type}] API User ID/Password not configured.`);
            return false;
        }
    } else if (type === 'bin') {
        const userId = process.env.VISA_BIN_API_USERID;
        const password = process.env.VISA_BIN_API_PASSWORD;
        if (!userId || !password || userId.includes('YOUR_VISA')) {
            console.error(`[Visa Service - ${type}] API User ID/Password not configured.`);
            return false;
        }
    }
    else { // provisioning
        const apiKey = process.env.VISA_API_KEY;
        if (!apiKey || apiKey.includes('YOUR_VISA')) {
            console.warn(`[Visa Service - ${type}] API Key not configured. Using mock data.`);
            return false;
        }
    }
    return true;
};

/**
 * Simulates creating a new virtual card via Visa's API.
 * @param args - The arguments for creating a card.
 * @returns A promise that resolves with the mock card details.
 */
export async function createVirtualCard(args: CreateCardArgs): Promise<VisaCard> {
    console.log(`[Visa Service] Simulating virtual card creation for user: ${args.userId} in ${args.currency}`);
    checkApiKey('provisioning');

    await new Promise(resolve => setTimeout(resolve, 1400)); // Simulate API delay

    const newCard: VisaCard = {
        id: `visa_card_${Date.now()}`,
        // Visa cards start with 4
        pan: `444455556666${Math.floor(1000 + Math.random() * 9000)}`,
        expiry: {
            month: Math.floor(1 + Math.random() * 12),
            year: new Date().getFullYear() + 4
        },
        cvv: args.pin // Use the user's PIN for the new card
    };

    console.log(`[Visa Service] Mock card created successfully: ID ${newCard.id}`);
    return newCard;
}

/**
 * Simulates setting a card's PIN via the Visa PIN Services API.
 * @param cardProviderId - The unique ID of the card from Visa.
 * @param newPin - The new 4-digit PIN.
 * @returns A promise that resolves with the operation result.
 */
export async function setCardPin(cardProviderId: string, newPin: string): Promise<{ success: boolean, error?: string }> {
    console.log(`[Visa PIN Service] Setting PIN for card ${cardProviderId}`);
    // In a real app, this would make a secure call to Visa's /dps/v3/pins endpoint
    // with an encrypted payload containing the new PIN.
    await new Promise(resolve => setTimeout(resolve, 600));

    if (newPin.length !== 4) {
        return { success: false, error: 'PIN must be 4 digits.' };
    }
    
    console.log(`[Visa PIN Service] PIN for card ${cardProviderId} successfully updated (simulated).`);
    return { success: true };
}


/**
 * Simulates activating a card via the Visa DPS Card Activation API.
 * @param cardProviderId - The unique ID of the card from Visa.
 * @returns A promise that resolves with the activation result.
 */
export async function activateCard(cardProviderId: string): Promise<{ success: boolean, error?: string }> {
    console.log(`[Visa Service] Activating card with provider ID: ${cardProviderId}`);
    checkApiKey('provisioning');
    
    // Based on the documentation, this would be a POST to /dps/v3/cards/activations
    // with an encrypted payload. For this mock, we'll just simulate a successful call.

    await new Promise(resolve => setTimeout(resolve, 900));

    // Simulate success based on a mock condition
    if (cardProviderId.includes('fail')) {
        console.error('[Visa Service] Mock card activation failed.');
        return { success: false, error: "L'activation auprès de Visa a échoué. Le fournisseur a rejeté la demande." };
    }

    console.log(`[Visa Service] Card ${cardProviderId} activated successfully.`);
    return { success: true };
}

/**
 * Generates a dynamic CVV2 for a transaction using the Visa VPA API.
 * POST /vpa/v1/securityCodes
 * @param cardProviderId - The unique ID of the card from Visa.
 * @returns A promise that resolves with the security code details.
 */
export async function getSecurityCode(cardProviderId: string): Promise<SecurityCodeResponse> {
    console.log(`[Visa VPA Service] Requesting dynamic security code for card ID: ${cardProviderId}`);
    
    const hasCredentials = checkApiKey('vpa');
    if (!hasCredentials) {
        const errorMessage = "Les identifiants pour l'API Visa VPA ne sont pas configurés. Veuillez mettre à jour votre fichier .env.";
        console.error(`[Visa VPA Service] ${errorMessage}`);
        return { success: false, error: errorMessage };
    }


    const auth = Buffer.from(`${process.env.VISA_VPA_API_USERID}:${process.env.VISA_VPA_API_PASSWORD}`).toString('base64');
    
    const payload = {
        cardId: cardProviderId,
        securityCodeType: "CVV2"
    };

    try {
        const response = await fetch(`${process.env.VISA_API_URL}/vpa/v1/securityCodes`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok && data.securityCode) {
            console.log(`[Visa VPA Service] Successfully retrieved dynamic security code for card ${cardProviderId}.`);
            return { success: true, securityCode: data.securityCode };
        } else {
            console.error('Visa VPA Get Security Code Error:', data);
            const errorMessage = data.errors?.[0]?.message || 'Failed to retrieve security code from Visa.';
            return { success: false, error: errorMessage };
        }
    } catch (error: any) {
        console.error('[Visa VPA Service] Critical error getting security code:', error);
        return { success: false, error: `An unexpected error occurred: ${error.message}` };
    }
}


/**
 * Simulates funding or debiting a Visa card.
 * A negative amount represents a debit.
 * @param cardId - The Visa-provided ID of the card.
 * @param amount - The amount to transfer. Can be negative.
 * @returns A promise that resolves with the transaction result.
 */
export async function fundOrDebitCard(cardId: string, amount: number): Promise<FundingResponse> {
    const action = amount >= 0 ? 'Funding' : 'Debiting';
    console.log(`[Visa Service] ${action} card ${cardId} with amount ${amount}`);
    checkApiKey('provisioning');

    if (Math.abs(amount) > 10000) {
        return { success: false, error: 'Transfer amount exceeds the limit for this card.' };
    }
    
    await new Promise(resolve => setTimeout(resolve, 900));

    const transactionId = `VISA_FD_${Date.now()}`;
    console.log(`[Visa Service] Mock ${action} successful. Transaction ID: ${transactionId}`);
    
    return { success: true, transactionId };
}


/**
 * Downloads the BIN attribute file from Visa.
 * This is a server-side function that would typically be run as part of a scheduled job.
 * It simulates downloading and processing the BIN file, as mTLS is not available in this environment.
 * Ref: https://developer.visa.com/capabilities/visa-bin-attribute-sharing-service/reference#tag/BIN-File-Transfer/operation/Bin%20File%20Transfer%20-%20POST_v1%20-%20Latest
 */
export async function downloadBinAttributeFile(): Promise<{ success: boolean; message: string; filePath?: string; error?: string }> {
    console.log('[Visa BIN Service] Initiating download of BIN attribute file.');

    const hasCredentials = checkApiKey('bin');

    if (!hasCredentials) {
        return { success: false, error: "Les identifiants API Visa pour le service BIN ne sont pas configurés." };
    }
    
    // The actual API requires Mutual TLS (mTLS) with client certificates.
    // This cannot be done from this environment, so we will simulate the logic.
    console.warn("[Visa BIN Service] This service requires mTLS which cannot be performed here. Simulating API calls and file processing.");

    try {
        // STEP 1: Simulate GET /vbas/v1/bin/attributes/files to find the latest file
        console.log('[Visa BIN Service] Simulating: GET /vbas/v1/bin/attributes/files');
        await new Promise(resolve => setTimeout(resolve, 500)); 
        const latestFileId = `baa-v2-100-daily-${new Date().toISOString().split('T')[0].replace(/-/g,'')}-01`;
        console.log(`[Visa BIN Service] Found latest file ID: ${latestFileId}`);

        // STEP 2: Simulate POST /vbas/v1/bin/attributes/files/{fileId} to download the file
        console.log(`[Visa BIN Service] Simulating: POST /vbas/v1/bin/attributes/files/${latestFileId}`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate download time
        
        // This would be the actual response from Visa, which is a zip file buffer.
        // We will create a mock buffer representing a simple text file inside a zip.
        // In a real implementation, `response.arrayBuffer()` would be used.
        const mockFileContent = "This is a mock BIN attribute file. In a real scenario, this would be a zipped binary file.";
        const mockFileBuffer = Buffer.from(mockFileContent);
        
        // STEP 3: Save the file to the server's temporary filesystem.
        const fileName = `${latestFileId}.zip`;
        const directoryPath = path.join('/tmp', 'visa_bins'); // Use /tmp for temporary files
        await fs.mkdir(directoryPath, { recursive: true });
        const filePath = path.join(directoryPath, fileName);
        
        await fs.writeFile(filePath, mockFileBuffer);

        console.log(`[Visa BIN Service] Mock file saved to: ${filePath}`);

        return {
            success: true,
            message: "Le fichier des attributs BIN a été téléchargé et sauvegardé avec succès sur le serveur (simulation).",
            filePath: filePath, // Return the server path
        };

    } catch (error: any) {
        console.error('[Visa BIN Service] Error during simulated download:', error);
        return { success: false, error: `An error occurred during the simulation: ${error.message}` };
    }
}


/**
 * Simulates a request to Visa for in-app provisioning data.
 * POST /digital-enablement/v1/provisioning/card-on-file
 * @param cardProviderId The Visa-provided unique ID for the card.
 * @returns A promise that resolves with the provisioning data.
 */
export async function requestInAppProvisioningData(cardProviderId: string): Promise<{ success: boolean; data?: InAppProvisioningData; error?: string }> {
    console.log(`[Visa In-App Provisioning] Requesting data for card: ${cardProviderId}`);
    // A real implementation would check for specific provisioning API keys.
    checkApiKey('provisioning');

    // In a real scenario, this would involve creating a complex payload with encrypted data
    // and calling the Visa API endpoint with mTLS authentication.
    
    await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate API delay

    // Mock a successful response payload
    const mockData: InAppProvisioningData = {
        encryptedPassData: "mock-encrypted-pass-data...",
        activationData: "mock-activation-data...",
        ephemeralPublicKey: "mock-ephemeral-public-key..."
    };

    console.log("[Visa In-App Provisioning] Mock data generated successfully.");

    return { success: true, data: mockData };
}

const VISA_AR_API_KEY = process.env.VISA_AR_API_KEY;
const VISA_AR_SHARED_SECRET = process.env.VISA_AR_SHARED_SECRET;

/**
 * Fetches the latest card details for a given PAN from Visa Account Updater.
 * @param pan The Primary Account Number of the card to update.
 * @returns A promise that resolves with the updated card details or an error.
 */
export async function getUpdatedCardDetails(pan: string): Promise<AccountUpdaterResponse> {
    console.log(`[Visa AR Service] Fetching updated details for PAN ending in ${pan.slice(-4)}`);
    
    const hasCredentials = (() => {
        if (!VISA_AR_API_KEY || !VISA_AR_SHARED_SECRET || VISA_AR_API_KEY.includes('YOUR_KEY')) {
            console.warn("[Visa AR Service] API Key/Secret not configured. Using mock data.");
            return false;
        }
        return true;
    })();

    if (!hasCredentials) {
        return { success: false, error: "Le service de mise à jour de carte n'est pas configuré."};
    }
    
    // Simulate real API call if credentials were set
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Mock logic: If a card is "old", return new expiry. Otherwise, say it's up to date.
    if (pan.endsWith('1111')) { // Mock an "old" card
        const currentYear = new Date().getFullYear();
        const newExpiryYear = (currentYear + 3).toString();
        const newExpiryMonth = (Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0');

        const updatedCard = {
            pan: pan, // The PAN itself doesn't change
            expiryMonth: newExpiryMonth,
            expiryYear: newExpiryYear,
        };

        console.log(`[Visa AR Service] Found updated details for PAN ending in ${pan.slice(-4)}: New Expiry ${newExpiryMonth}/${newExpiryYear}`);
        return { success: true, card: updatedCard };
    } else {
        console.log(`[Visa AR Service] Card details are already up to date for PAN ending in ${pan.slice(-4)}`);
        return { success: false, error: 'Les informations de la carte sont déjà à jour.' };
    }
}
