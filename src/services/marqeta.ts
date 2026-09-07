/**
 * @fileoverview Service de communication avec l'API FYATU Core et DIVA.
 * Ce service gère l'émission, les webhooks, les détails réseau et les commandes par lots.
 */

import config from '@/config';
import crypto from 'crypto';

const { baseUrl, appToken, adminAccessToken, webhookSecret } = config.fyatu;

export class FYATUError extends Error {
    errorCode: string;
    status: number;

    constructor(message: string, errorCode: string, status: number) {
        super(message);
        this.name = 'FYATUError';
        this.errorCode = errorCode;
        this.status = status;
    }
}

/**
 * Effectue une requête autorisée vers l'API FYATU.
 * Si les identifiants sont absents, renvoie un message de maintenance.
 */
async function fyatuRequest(
    endpoint: string, 
    method: string = 'GET', 
    body?: any, 
    options: {
        queryParams?: Record<string, any>,
        idempotencyKey?: string,
        ipAddress?: string
    } = {}
): Promise<any> {
    if (!appToken || !adminAccessToken || appToken.includes('YOUR_')) {
        throw new Error("Le service de gestion des cartes est actuellement en maintenance. Veuillez réessayer ultérieurement.");
    }

    let url = `${baseUrl}${endpoint}`;
    if (options.queryParams) {
        const params = new URLSearchParams();
        for (const key in options.queryParams) {
            if (options.queryParams[key] !== undefined) {
                params.append(key, options.queryParams[key].toString());
            }
        }
        const qs = params.toString();
        if (qs) url += `?${qs}`;
    }
    
    const authHeader = `Basic ${Buffer.from(`${appToken}:${adminAccessToken}`).toString('base64')}`;
    const headers: Record<string, string> = {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    if (options.ipAddress) headers['X-Forwarded-For'] = options.ipAddress;

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store'
        });

        if (response.status === 204) return { success: true };

        const data = await response.json();

        if (!response.ok) {
            throw new FYATUError(data.error_message || "Erreur de communication fournisseur", data.error_code, response.status);
        }

        return data;
    } catch (e: any) {
        if (e.name === 'TypeError') {
            throw new Error("Impossible de contacter le serveur d'émission. Vérifiez votre connexion.");
        }
        throw e;
    }
}

/**
 * Valide la signature HMAC-SHA256 des webhooks FYATU.
 */
export async function validateWebhookSignature(payload: string, signature: string): Promise<boolean> {
    if (!webhookSecret) return false;
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(payload);
    const expected = hmac.digest('base64');
    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch (e) {
        return false;
    }
}

// --- Fonctions Utilisateur ---

/**
 * Crée ou met à jour un utilisateur dans l'écosystème fournisseur.
 * Le 'token' est notre identifiant unique (user_cp_ID).
 */
export async function createOrUpdateFYATUUser(userData: { token: string; firstName: string; lastName: string; email: string }) {
    try {
        return await fyatuRequest('/users', 'POST', {
            token: userData.token,
            first_name: userData.firstName,
            last_name: userData.lastName,
            email: userData.email,
            active: true
        });
    } catch (e: any) {
        if (e.status === 409) {
            return await fyatuRequest(`/users/${userData.token}`, 'PUT', {
                first_name: userData.firstName,
                last_name: userData.lastName,
                email: userData.email
            });
        }
        throw e;
    }
}

/**
 * Change l'état d'un utilisateur global (ACTIVE, SUSPENDED, CLOSED).
 */
export async function transitionUserState(
    userToken: string,
    state: 'ACTIVE' | 'SUSPENDED' | 'CLOSED',
    reason: string = 'Status updated by CashPay Admin',
    reasonCode: string = '00'
) {
    return fyatuRequest('/usertransitions', 'POST', {
        user_token: userToken,
        state,
        reason_code: reasonCode,
        reason
    });
}

/**
 * Récupère les détails d'un utilisateur fournisseur.
 */
export async function getFYATUUser(userToken: string) {
    return fyatuRequest(`/users/${userToken}`);
}

// --- Fonctions Carte ---

export async function issueFYATUCard(args: { userToken: string; cardProductToken: string }, idempotencyKey?: string) {
    return fyatuRequest('/cards', 'POST', {
        user_token: args.userToken,
        card_product_token: args.cardProductToken,
    }, { idempotencyKey });
}

/**
 * Assigne une carte physique spécifique à un utilisateur.
 */
export async function issuePhysicalCardToUser(args: { userToken: string; cardProductToken: string; cardToken?: string }, idempotencyKey?: string) {
    return fyatuRequest('/cards', 'POST', {
        user_token: args.userToken,
        card_product_token: args.cardProductToken,
        token: args.cardToken, 
        fulfillment: {
            shipping_method: "LOCAL_DELIVERY"
        }
    }, { idempotencyKey });
}

export async function getFYATUCard(cardToken: string) {
    return fyatuRequest(`/cards/${cardToken}`);
}

/**
 * Met à jour une carte existante (métadonnées, fulfillment, etc.)
 */
export async function updateFYATUCard(cardToken: string, data: any) {
    return fyatuRequest(`/cards/${cardToken}`, 'PUT', data);
}

/**
 * Change l'état d'une carte (ACTIVE, SUSPENDED, TERMINATED).
 */
export async function transitionCardState(
    cardToken: string, 
    state: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED', 
    reason: string = 'User requested',
    reasonCode: string = '00'
) {
    return fyatuRequest('/cardtransitions', 'POST', {
        card_token: cardToken,
        state,
        reason_code: reasonCode,
        reason
    });
}

export async function getSensitiveCardData(cardToken: string) {
    return fyatuRequest(`/cards/${cardToken}/showpan`, 'GET', undefined, { queryParams: { show_cvv2: true } });
}

/**
 * Définit le code PIN d'une carte chez le fournisseur.
 */
export async function setCardPin(cardToken: string, pin: string, idempotencyKey: string, ipAddress: string) {
    const tokenResult = await fyatuRequest('/pins/controltokens', 'POST', { card_token: cardToken }, { idempotencyKey, ipAddress });
    return fyatuRequest(`/pins`, 'POST', {
        control_token: tokenResult.control_token,
        pin: pin
    }, { idempotencyKey, ipAddress });
}

export async function update3DSConfiguration(cardToken: string, active: boolean) {
    return fyatuRequest(`/cards/${cardToken}/3dssecure`, 'PUT', { active });
}

export async function getInAppProvisioningData(cardToken: string, deviceType: 'APPLE_PAY' | 'GOOGLE_PAY', deviceId: string) {
    return fyatuRequest(`/cards/${cardToken}/provisioningdata`, 'POST', {
        device_type: deviceType,
        device_id: deviceId
    });
}

// --- Bulk Card Orders ---

export async function createBulkCardOrder(args: { cardProductToken: string, quantity: number }, token: string) {
    return fyatuRequest('/bulkissuances', 'POST', {
        token,
        card_product_token: args.cardProductToken,
        quantity: args.quantity,
        fulfillment: {
            shipping_method: "LOCAL_DELIVERY"
        }
    });
}

export async function getBulkCardOrder(token: string) {
    return fyatuRequest(`/bulkissuances/${token}`);
}

export async function listBulkCardOrders(count: number = 10) {
    return fyatuRequest('/bulkissuances', 'GET', undefined, { queryParams: { count } });
}

// --- Diva Activity & Balances ---

export async function getCardActivity(cardToken: string, count: number = 20) {
    return fyatuRequest(`/cards/${cardToken}/activity`, 'GET', undefined, { queryParams: { count } });
}

export async function getCardActivityNetworkDetails(cardToken: string, activityToken: string) {
    return fyatuRequest(`/cards/${cardToken}/activity/${activityToken}/networkdetails`);
}

export async function getProgramFundingBalances() {
    return fyatuRequest('/fundingsources/program');
}

/**
 * Formate une réponse Gateway JIT Funding selon les standards fournisseurs.
 */
export function formatJitResponse(jitToken: string, approve: boolean, amount: number, memo?: string) {
    return {
        jit_funding: {
            token: jitToken,
            method: approve ? "pgfs.authorization" : "pgfs.decline",
            user_notified: true,
            memo: memo || (approve ? "Approved by Sovereign Gateway" : "Declined by Sovereign Gateway")
        },
        response: {
            code: approve ? "0000" : "1001",
            memo: approve ? "Success" : "Insufficient Funds"
        }
    };
}
