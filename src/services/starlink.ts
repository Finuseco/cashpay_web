
'use server';

/**
 * @fileoverview Service de communication avec l'API Starlink Enterprise v2.
 * Documentation: https://starlink.com/api/public/swagger/index.html?urls.primaryName=V2
 */

const AUTH_URL = 'https://starlink.com/api/auth/connect/token';
const API_BASE_URL = 'https://starlink.com/api/public/v2';

interface StarlinkTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

// Cache des jetons en mémoire (valide durant l'exécution du serveur)
const tokenCache = new Map<string, { token: string, expiresAt: number }>();

/**
 * Récupère un jeton d'accès OAuth2 en utilisant les identifiants Client Credentials.
 */
export async function getStarlinkToken(clientId: string, clientSecret: string): Promise<string | null> {
    const cacheKey = clientId;
    const cached = tokenCache.get(cacheKey);
    
    // Utilise le cache s'il est encore valide (avec une marge de 1 minute)
    if (cached && cached.expiresAt > Date.now() + 60000) {
        return cached.token;
    }

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'client_id': clientId,
                'client_secret': clientSecret,
                'grant_type': 'client_credentials',
            }),
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Starlink Auth] Erreur lors de la récupération du token:', errorText);
            return null;
        }

        const data: StarlinkTokenResponse = await response.json();
        
        // Mettre en cache le jeton
        tokenCache.set(cacheKey, { 
            token: data.access_token, 
            expiresAt: Date.now() + (data.expires_in * 1000) 
        });

        return data.access_token;
    } catch (error) {
        console.error('[Starlink Auth] Erreur critique:', error);
        return null;
    }
}

/**
 * Effectue une requête autorisée vers l'API Starlink avec gestion du rafraîchissement.
 */
async function makeAuthorizedRequest(clientId: string, clientSecret: string, endpoint: string, method: string = 'GET', body?: any) {
    let token = await getStarlinkToken(clientId, clientSecret);
    if (!token) throw new Error("Impossible de s'authentifier auprès de Starlink.");

    const url = `${API_BASE_URL}${endpoint}`;
    const getHeaders = (t: string) => ({
        'Accept': 'application/json',
        'Authorization': `Bearer ${t}`,
        'Content-Type': 'application/json',
    });

    let response = await fetch(url, { 
        method, 
        headers: getHeaders(token), 
        body: body ? JSON.stringify(body) : undefined, 
        cache: 'no-store' 
    });

    // Si le jeton a expiré (401), on vide le cache et on réessaie une fois
    if (response.status === 401) {
        console.log(`[Starlink API] Token expiré pour ${clientId}, tentative de rafraîchissement...`);
        tokenCache.delete(clientId);
        token = await getStarlinkToken(clientId, clientSecret);
        if (!token) throw new Error("Échec de l'authentification après renouvellement du jeton.");
        
        response = await fetch(url, { 
            method, 
            headers: getHeaders(token), 
            body: body ? JSON.stringify(body) : undefined, 
            cache: 'no-store' 
        });
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Erreur API Starlink: ${response.status}`);
    }

    return response.json();
}

/**
 * Récupère les informations du compte associé.
 */
export async function fetchStarlinkAccount(clientId: string, clientSecret: string) {
    return makeAuthorizedRequest(clientId, clientSecret, '/account');
}

/**
 * Récupère la liste des terminaux (kits) pour un compte donné.
 */
export async function fetchUserTerminals(clientId: string, clientSecret: string) {
    return makeAuthorizedRequest(clientId, clientSecret, '/user-terminals');
}

/**
 * Redémarre un terminal spécifique.
 */
export async function rebootTerminal(clientId: string, clientSecret: string, userTerminalId: string) {
    return makeAuthorizedRequest(clientId, clientSecret, `/user-terminals/${userTerminalId}/reboot`, 'POST');
}

/**
 * Récupère l'utilisation des données.
 */
export async function fetchDataUsage(clientId: string, clientSecret: string, payload: any) {
    return makeAuthorizedRequest(clientId, clientSecret, '/data-usage/query', 'POST', payload);
}
