

'use server';

/**
 * @fileoverview A mock service for interacting with the Mastercard Send and MDES APIs.
 * This simulates the creation and funding of virtual cards.
 */

interface CreateCardArgs {
    userId: string;
    currency: string;
    pin: string;
}

interface MastercardCard {
    id: string; // Mastercard's unique ID for the card
    pan: string;
    expiry: { month: number, year: number };
    cvv: string;
}

interface TransferResponse {
    success: boolean;
    transactionId?: string;
    error?: string;
}

const checkApiKey = () => {
    const apiKey = process.env.MASTERCARD_API_KEY;
    if (!apiKey || apiKey.includes('YOUR_MC_API_KEY')) {
        console.warn("[Mastercard Service] API Key not configured. Using mock data.");
        return false;
    }
    return true;
};

/**
 * Simulates creating a new virtual card via Mastercard Digital Enablement Service (MDES).
 * @param args - The arguments for creating a card.
 * @returns A promise that resolves with the mock card details.
 */
export async function createVirtualCard(args: CreateCardArgs): Promise<MastercardCard> {
    console.log(`[Mastercard MDES] Simulating virtual card creation for user: ${args.userId} in ${args.currency}`);
    checkApiKey();

    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay

    const newCard: MastercardCard = {
        id: `mc_card_${Date.now()}`,
        pan: `555544443333${Math.floor(1000 + Math.random() * 9000)}`,
        expiry: {
            month: Math.floor(1 + Math.random() * 12),
            year: new Date().getFullYear() + 5
        },
        cvv: args.pin // Use the user's PIN for the new card
    };

    console.log(`[Mastercard MDES] Mock card created successfully: ID ${newCard.id}`);
    return newCard;
}


/**
 * Simulates setting a card's PIN via the Mastercard API.
 * @param cardProviderId - The unique ID of the card from Mastercard.
 * @param newPin - The new 4-digit PIN.
 * @returns A promise that resolves with the operation result.
 */
export async function setCardPin(cardProviderId: string, newPin: string): Promise<{ success: boolean, error?: string }> {
    console.log(`[Mastercard PIN Service] Setting PIN for card ${cardProviderId}`);
    await new Promise(resolve => setTimeout(resolve, 600));

    if (newPin.length !== 4) {
        return { success: false, error: 'PIN must be 4 digits.' };
    }
    
    console.log(`[Mastercard PIN Service] PIN for card ${cardProviderId} successfully updated (simulated).`);
    return { success: true };
}


/**
 * Simulates transferring money to a card using Mastercard Send API.
 * In a real scenario, this would be a funding transaction.
 * A negative amount can be used to simulate a debit for internal transfers.
 * @param cardId - The Mastercard-provided ID of the card.
 * @param amount - The amount to transfer. Can be negative.
 * @param currency - The currency of the transfer.
 * @returns A promise that resolves with the transaction result.
 */
export async function transferToCard(cardId: string, amount: number, currency: string): Promise<TransferResponse> {
    console.log(`[Mastercard Send] Simulating transfer of ${amount} ${currency} to card ${cardId}`);
    checkApiKey();

    if (Math.abs(amount) > 5000) {
        return { success: false, error: 'Transfer amount exceeds the limit for this card.' };
    }
    
    await new Promise(resolve => setTimeout(resolve, 800));

    const transactionId = `MCTRF_${Date.now()}`;
    console.log(`[Mastercard Send] Mock transfer successful. Transaction ID: ${transactionId}`);
    
    return { success: true, transactionId };
}
