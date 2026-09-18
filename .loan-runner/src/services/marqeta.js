"use strict";
/**
 * @fileoverview Service de communication avec l'API FYATU Core et DIVA.
 * Ce service gère l'émission, les webhooks, les détails réseau et les commandes par lots.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FYATUError = void 0;
exports.validateWebhookSignature = validateWebhookSignature;
exports.createOrUpdateFYATUUser = createOrUpdateFYATUUser;
exports.transitionUserState = transitionUserState;
exports.getFYATUUser = getFYATUUser;
exports.issueFYATUCard = issueFYATUCard;
exports.issuePhysicalCardToUser = issuePhysicalCardToUser;
exports.getFYATUCard = getFYATUCard;
exports.updateFYATUCard = updateFYATUCard;
exports.transitionCardState = transitionCardState;
exports.getSensitiveCardData = getSensitiveCardData;
exports.setCardPin = setCardPin;
exports.update3DSConfiguration = update3DSConfiguration;
exports.getInAppProvisioningData = getInAppProvisioningData;
exports.createBulkCardOrder = createBulkCardOrder;
exports.getBulkCardOrder = getBulkCardOrder;
exports.listBulkCardOrders = listBulkCardOrders;
exports.getCardActivity = getCardActivity;
exports.getCardActivityNetworkDetails = getCardActivityNetworkDetails;
exports.getProgramFundingBalances = getProgramFundingBalances;
exports.formatJitResponse = formatJitResponse;
const config_1 = __importDefault(require("@/config"));
const crypto_1 = __importDefault(require("crypto"));
const { baseUrl, appToken, adminAccessToken, webhookSecret } = config_1.default.fyatu;
class FYATUError extends Error {
    errorCode;
    status;
    constructor(message, errorCode, status) {
        super(message);
        this.name = 'FYATUError';
        this.errorCode = errorCode;
        this.status = status;
    }
}
exports.FYATUError = FYATUError;
/**
 * Effectue une requête autorisée vers l'API FYATU.
 * Si les identifiants sont absents, renvoie un message de maintenance.
 */
async function fyatuRequest(endpoint, method = 'GET', body, options = {}) {
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
        if (qs)
            url += `?${qs}`;
    }
    const authHeader = `Basic ${Buffer.from(`${appToken}:${adminAccessToken}`).toString('base64')}`;
    const headers = {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    if (options.idempotencyKey)
        headers['Idempotency-Key'] = options.idempotencyKey;
    if (options.ipAddress)
        headers['X-Forwarded-For'] = options.ipAddress;
    try {
        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store'
        });
        if (response.status === 204)
            return { success: true };
        const data = await response.json();
        if (!response.ok) {
            throw new FYATUError(data.error_message || "Erreur de communication fournisseur", data.error_code, response.status);
        }
        return data;
    }
    catch (e) {
        if (e.name === 'TypeError') {
            throw new Error("Impossible de contacter le serveur d'émission. Vérifiez votre connexion.");
        }
        throw e;
    }
}
/**
 * Valide la signature HMAC-SHA256 des webhooks FYATU.
 */
async function validateWebhookSignature(payload, signature) {
    if (!webhookSecret)
        return false;
    const hmac = crypto_1.default.createHmac('sha256', webhookSecret);
    hmac.update(payload);
    const expected = hmac.digest('base64');
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    }
    catch (e) {
        return false;
    }
}
// --- Fonctions Utilisateur ---
/**
 * Crée ou met à jour un utilisateur dans l'écosystème fournisseur.
 * Le 'token' est notre identifiant unique (user_cp_ID).
 */
async function createOrUpdateFYATUUser(userData) {
    try {
        return await fyatuRequest('/users', 'POST', {
            token: userData.token,
            first_name: userData.firstName,
            last_name: userData.lastName,
            email: userData.email,
            active: true
        });
    }
    catch (e) {
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
async function transitionUserState(userToken, state, reason = 'Status updated by CashPay Admin', reasonCode = '00') {
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
async function getFYATUUser(userToken) {
    return fyatuRequest(`/users/${userToken}`);
}
// --- Fonctions Carte ---
async function issueFYATUCard(args, idempotencyKey) {
    return fyatuRequest('/cards', 'POST', {
        user_token: args.userToken,
        card_product_token: args.cardProductToken,
    }, { idempotencyKey });
}
/**
 * Assigne une carte physique spécifique à un utilisateur.
 */
async function issuePhysicalCardToUser(args, idempotencyKey) {
    return fyatuRequest('/cards', 'POST', {
        user_token: args.userToken,
        card_product_token: args.cardProductToken,
        token: args.cardToken,
        fulfillment: {
            shipping_method: "LOCAL_DELIVERY"
        }
    }, { idempotencyKey });
}
async function getFYATUCard(cardToken) {
    return fyatuRequest(`/cards/${cardToken}`);
}
/**
 * Met à jour une carte existante (métadonnées, fulfillment, etc.)
 */
async function updateFYATUCard(cardToken, data) {
    return fyatuRequest(`/cards/${cardToken}`, 'PUT', data);
}
/**
 * Change l'état d'une carte (ACTIVE, SUSPENDED, TERMINATED).
 */
async function transitionCardState(cardToken, state, reason = 'User requested', reasonCode = '00') {
    return fyatuRequest('/cardtransitions', 'POST', {
        card_token: cardToken,
        state,
        reason_code: reasonCode,
        reason
    });
}
async function getSensitiveCardData(cardToken) {
    return fyatuRequest(`/cards/${cardToken}/showpan`, 'GET', undefined, { queryParams: { show_cvv2: true } });
}
/**
 * Définit le code PIN d'une carte chez le fournisseur.
 */
async function setCardPin(cardToken, pin, idempotencyKey, ipAddress) {
    const tokenResult = await fyatuRequest('/pins/controltokens', 'POST', { card_token: cardToken }, { idempotencyKey, ipAddress });
    return fyatuRequest(`/pins`, 'POST', {
        control_token: tokenResult.control_token,
        pin: pin
    }, { idempotencyKey, ipAddress });
}
async function update3DSConfiguration(cardToken, active) {
    return fyatuRequest(`/cards/${cardToken}/3dssecure`, 'PUT', { active });
}
async function getInAppProvisioningData(cardToken, deviceType, deviceId) {
    return fyatuRequest(`/cards/${cardToken}/provisioningdata`, 'POST', {
        device_type: deviceType,
        device_id: deviceId
    });
}
// --- Bulk Card Orders ---
async function createBulkCardOrder(args, token) {
    return fyatuRequest('/bulkissuances', 'POST', {
        token,
        card_product_token: args.cardProductToken,
        quantity: args.quantity,
        fulfillment: {
            shipping_method: "LOCAL_DELIVERY"
        }
    });
}
async function getBulkCardOrder(token) {
    return fyatuRequest(`/bulkissuances/${token}`);
}
async function listBulkCardOrders(count = 10) {
    return fyatuRequest('/bulkissuances', 'GET', undefined, { queryParams: { count } });
}
// --- Diva Activity & Balances ---
async function getCardActivity(cardToken, count = 20) {
    return fyatuRequest(`/cards/${cardToken}/activity`, 'GET', undefined, { queryParams: { count } });
}
async function getCardActivityNetworkDetails(cardToken, activityToken) {
    return fyatuRequest(`/cards/${cardToken}/activity/${activityToken}/networkdetails`);
}
async function getProgramFundingBalances() {
    return fyatuRequest('/fundingsources/program');
}
/**
 * Formate une réponse Gateway JIT Funding selon les standards fournisseurs.
 */
function formatJitResponse(jitToken, approve, amount, memo) {
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
