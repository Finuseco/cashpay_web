import config from '@/config';
import crypto from 'crypto';

const { baseUrl, appId, secretKey } = config.fyatu;

export class FYATUError extends Error {
    errorCode: string;
    status: number;
    constructor(message: string, errorCode = 'FYATU_ERROR', status = 500) {
        super(message);
        this.name = 'FYATUError';
        this.errorCode = errorCode;
        this.status = status;
    }
}

let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;

function unwrap<T = any>(payload: any): T {
    return payload?.data ?? payload;
}

function providerError(data: any, status: number): FYATUError {
    const details = Array.isArray(data?.error?.details)
        ? ` ${data.error.details.map((d: any) => `${d.field || 'field'}: ${d.message || 'invalid'}`).join('; ')}`
        : '';
    return new FYATUError(
        `${data?.message || data?.error?.message || data?.error || 'Erreur API FYATU.'}${details}`,
        data?.error?.code || data?.code || data?.error_code || 'FYATU_API_ERROR',
        status
    );
}

async function getFYATUToken(): Promise<string> {
    if (!appId || !secretKey) {
        throw new FYATUError('Configuration FYATU manquante : FYATU_APP_ID et FYATU_SECRET_KEY sont requis.', 'FYATU_AUTH_CONFIG', 500);
    }

    const now = Date.now();
    if (cachedAccessToken && cachedTokenExpiresAt > now + 60_000) return cachedAccessToken;

    const response = await fetch(`${baseUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ appId, secretKey, grantType: 'client_credentials' }),
        cache: 'no-store'
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(data, response.status);

    const tokenData = unwrap<any>(data);
    const token = tokenData?.accessToken || tokenData?.access_token || tokenData?.token;
    if (!token) throw new FYATUError('JWT FYATU manquant dans la réponse /auth/token.', 'FYATU_TOKEN_MISSING', 502);

    cachedAccessToken = token;
    const expiresIn = Number(tokenData?.expiresIn || tokenData?.expires_in || 86400);
    cachedTokenExpiresAt = now + expiresIn * 1000;
    return token;
}

async function fyatuRequest(
    endpoint: string,
    method = 'GET',
    body?: any,
    options: { queryParams?: Record<string, any>; idempotencyKey?: string; ipAddress?: string } = {}
): Promise<any> {
    const token = await getFYATUToken();
    let url = `${baseUrl}${endpoint}`;

    if (options.queryParams) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.queryParams)) {
            if (value !== undefined && value !== null) params.append(key, String(value));
        }
        const query = params.toString();
        if (query) url += `?${query}`;
    }

    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    if (options.ipAddress) headers['X-Forwarded-For'] = options.ipAddress;

    let response: Response;
    try {
        response = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            cache: 'no-store'
        });
    } catch (e: any) {
        throw new FYATUError(`Impossible de contacter l'API FYATU : ${e?.message || 'erreur réseau'}.`, 'FYATU_NETWORK_ERROR', 502);
    }

    if (response.status === 204) return { success: true };
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw providerError(data, response.status);
    return data;
}

/** FYATU v3 signe le champ data en HMAC-SHA256 hexadécimal. */
export async function validateWebhookSignature(payload: string, signature: string, webhookSecret?: string): Promise<boolean> {
    if (!webhookSecret || !signature) return false;
    try {
        let message = payload;
        const parsed = JSON.parse(payload);
        if (parsed && parsed.data !== undefined) message = JSON.stringify(parsed.data);

        const expected = crypto.createHmac('sha256', webhookSecret).update(message, 'utf8').digest('hex');
        const received = Buffer.from(signature.trim(), 'hex');
        const expectedBuffer = Buffer.from(expected, 'hex');
        return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
    } catch {
        return false;
    }
}

function firstDefined(obj: any, keys: string[]): any {
    for (const key of keys) if (obj?.[key] !== undefined && obj?.[key] !== null && obj?.[key] !== '') return obj[key];
    return undefined;
}

/** Crée ou retrouve le cardholder FYATU correspondant à l'utilisateur CashPay. */
export async function createOrUpdateFYATUUser(userData: any) {
    const externalId = String(userData.externalId || userData.token || '');
    if (!externalId) throw new FYATUError('Identifiant externe CashPay manquant.', 'FYATU_CARDHOLDER_EXTERNAL_ID', 400);

    const user = userData.user || userData;
    const firstName = String(firstDefined(user, ['firstName', 'first_name']) || '').trim();
    const lastName = String(firstDefined(user, ['lastName', 'last_name']) || '').trim();
    const email = String(firstDefined(user, ['email']) || '').trim();
    const phone = String(firstDefined(user, ['phone', 'phone_number', 'mobile']) || '').trim();
    const dateOfBirth = firstDefined(user, ['dateOfBirth', 'date_of_birth', 'birth_date']);
    const genderRaw = String(firstDefined(user, ['gender', 'sex']) || '').toUpperCase();
    const gender = genderRaw === 'MALE' || genderRaw === 'FEMALE' ? genderRaw : undefined;
    const country = String(firstDefined(user, ['countryCode', 'country_code', 'country']) || '').toUpperCase();
    const address = String(firstDefined(user, ['address', 'address_line1', 'street']) || '').trim();
    const city = String(firstDefined(user, ['city']) || '').trim();
    const state = String(firstDefined(user, ['state', 'province']) || '').trim();
    const zipCode = String(firstDefined(user, ['zipCode', 'zip_code', 'postal_code']) || '').trim();

    const missing = [
        ['firstName', firstName], ['lastName', lastName], ['email', email], ['phone', phone],
        ['dateOfBirth', dateOfBirth], ['gender', gender], ['country', country],
        ['address', address], ['city', city], ['state', state], ['zipCode', zipCode]
    ].filter(([, value]) => value === undefined || value === '').map(([key]) => key);

    if (missing.length) {
        throw new FYATUError(`Profil utilisateur incomplet pour FYATU : ${missing.join(', ')}.`, 'FYATU_CARDHOLDER_PROFILE_INCOMPLETE', 400);
    }

    const payload: any = {
        externalId,
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth: String(dateOfBirth),
        gender,
        address,
        city,
        state,
        country,
        zipCode
    };

    if (userData.kyc) payload.kyc = userData.kyc;

    try {
        return unwrap(await fyatuRequest('/cardholders', 'POST', payload));
    } catch (e: any) {
        if (e?.status !== 409) throw e;
        const listed = unwrap<any>(await fyatuRequest('/cardholders', 'GET', undefined, { queryParams: { search: email, page: 1, limit: 100 } }));
        const cardholders = listed?.cardholders || [];
        const existing = cardholders.find((c: any) => String(c.email || '').toLowerCase() === email.toLowerCase());
        if (!existing?.id) throw e;
        const updatePayload: any = {
            firstName,
            lastName,
            phone,
            dateOfBirth: String(dateOfBirth),
            gender,
            address,
            city,
            state,
            country,
            zipCode,
            externalId
        };
        return unwrap(await fyatuRequest(`/cardholders/${existing.id}`, 'PATCH', updatePayload));
    }
}

export async function transitionUserState(userToken: string, state: 'ACTIVE' | 'SUSPENDED' | 'CLOSED', reason = 'Status updated by CashPay Admin', reasonCode = '00') {
    // Conservé pour compatibilité d'import. Les états de cardholder FYATU v3 sont gérés via les endpoints cardholder.
    return { success: true, userToken, state, reason, reasonCode, providerManaged: false };
}

export async function getFYATUUser(userToken: string) {
    return fyatuRequest(`/cardholders/${userToken}`).then(unwrap);
}

/**
 * Signature conservée pour card.actions.ts. Le token de produit devient productId FYATU.
 * amount doit respecter le minimum FYATU (5 USD/EUR).
 */
export async function issueFYATUCard(args: {
    userToken: string;
    cardProductToken: string;
    cardholderId?: string;
    amount?: number;
    name?: string;
}, idempotencyKey?: string) {
    const cardholderId = args.cardholderId || (args.userToken.startsWith('ch_') ? args.userToken : undefined);
    if (!cardholderId) throw new FYATUError('cardholderId FYATU requis pour créer la carte.', 'FYATU_CARDHOLDER_ID_MISSING', 400);
    const amount = Number(args.amount ?? process.env.FYATU_CARD_INITIAL_AMOUNT ?? 5);
    if (!Number.isFinite(amount) || amount < 5) throw new FYATUError('Le financement initial FYATU doit être au minimum de 5 USD/EUR.', 'FYATU_CARD_AMOUNT_MINIMUM', 400);

    return unwrap(await fyatuRequest('/cards', 'POST', {
        cardholderId,
        amount,
        ...(args.name ? { name: args.name } : {}),
        productId: args.cardProductToken
    }, { idempotencyKey }));
}

/** FYATU v3 public ne documente pas la création directe d'une carte physique. */
export async function issuePhysicalCardToUser(): Promise<never> {
    throw new FYATUError('La création de carte physique n’est pas exposée par l’API FYATU v3 publique actuelle. La demande physique reste donc gérée par CashPay.', 'FYATU_PHYSICAL_CARD_NOT_SUPPORTED', 501);
}

export async function getFYATUCard(cardToken: string) {
    return unwrap(await fyatuRequest(`/cards/${cardToken}`));
}

/** Conservé pour compatibilité. Les métadonnées de nickname restent locales à CashPay. */
export async function updateFYATUCard(cardToken: string, data: any) {
    return { success: true, id: cardToken, metadata: data?.metadata || {}, providerManaged: false };
}

export async function transitionCardState(cardToken: string, state: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED', reason = 'User requested', reasonCode = '00') {
    if (state === 'ACTIVE') return unwrap(await fyatuRequest(`/cards/${cardToken}/unfreeze`, 'POST'));
    if (state === 'SUSPENDED') return unwrap(await fyatuRequest(`/cards/${cardToken}/freeze`, 'POST'));
    if (state === 'TERMINATED') return unwrap(await fyatuRequest(`/cards/${cardToken}`, 'DELETE'));
    throw new FYATUError(`État de carte non supporté : ${state}.`, 'FYATU_CARD_STATE_INVALID', 400);
}

export async function getSensitiveCardData(cardToken: string) {
    return getFYATUCard(cardToken);
}

/** FYATU v3 ne documente actuellement aucun endpoint public de définition du PIN. */
export async function setCardPin(): Promise<never> {
    throw new FYATUError('La définition du PIN n’est pas exposée par l’API FYATU v3 publique actuelle. Aucun endpoint PIN non documenté n’est appelé.', 'FYATU_PIN_NOT_SUPPORTED', 501);
}

export async function update3DSConfiguration(cardToken: string, active: boolean) {
    return { success: true, id: cardToken, active, providerManaged: false };
}

export async function getInAppProvisioningData(): Promise<never> {
    throw new FYATUError('Le provisioning Apple Pay / Google Pay n’est pas exposé dans les endpoints publics FYATU v3 consultés.', 'FYATU_PROVISIONING_NOT_SUPPORTED', 501);
}

export async function createBulkCardOrder(): Promise<never> {
    throw new FYATUError('Les commandes bulk ne font pas partie des endpoints publics FYATU v3 utilisés par CashPay.', 'FYATU_BULK_NOT_SUPPORTED', 501);
}

export async function getBulkCardOrder(): Promise<never> { throw new FYATUError('Bulk issuance non supporté par cette intégration FYATU v3.', 'FYATU_BULK_NOT_SUPPORTED', 501); }
export async function listBulkCardOrders(): Promise<never> { throw new FYATUError('Bulk issuance non supporté par cette intégration FYATU v3.', 'FYATU_BULK_NOT_SUPPORTED', 501); }

/** Compatibilité avec l'ancien nom : il retourne désormais les transactions FYATU v3. */
export async function getCardActivity(cardToken: string, count = 20) {
    return getCardTransactions(cardToken, { page: 1, limit: Math.min(Math.max(count, 1), 100) });
}

export async function getCardTransactions(cardToken: string, params: { page?: number; limit?: number; status?: string } = {}) {
    const data = unwrap<any>(await fyatuRequest(`/cards/${cardToken}/transactions`, 'GET', undefined, {
        queryParams: { page: params.page ?? 1, limit: Math.min(params.limit ?? 20, 100), ...(params.status ? { status: params.status } : {}) }
    }));
    return data;
}

export async function getCardActivityNetworkDetails(): Promise<never> {
    throw new FYATUError('Les network details de l’ancien fournisseur ne font pas partie de l’API FYATU v3.', 'FYATU_NETWORK_DETAILS_NOT_SUPPORTED', 501);
}

export async function getProgramFundingBalances() {
    return unwrap(await fyatuRequest('/wallet'));
}

export function formatJitResponse(jitToken: string, approve: boolean, amount: number, memo?: string) {
    return {
        jit_funding: {
            token: jitToken,
            method: approve ? 'pgfs.authorization' : 'pgfs.decline',
            user_notified: true,
            memo: memo || (approve ? 'Approved by CashPay All' : 'Declined by CashPay All')
        },
        response: { code: approve ? '0000' : '1001', memo: approve ? 'Success' : 'Insufficient Funds', amount }
    };
}
