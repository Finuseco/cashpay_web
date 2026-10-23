// Module serveur uniquement (appelé par les actions et les routes API).
// Il ne porte volontairement plus la directive 'use server' : sinon chaque
// fonction exportée (dont sendBitcoinToAddress) deviendrait un point d'entrée
// appelable depuis le navigateur.

const RPC_USER = process.env.BITCOIN_RPC_USER;
const RPC_PASSWORD = process.env.BITCOIN_RPC_PASSWORD;
const RPC_HOST = process.env.BITCOIN_RPC_HOST || '127.0.0.1';
const RPC_PORT = process.env.BITCOIN_RPC_PORT || '8332';
const RPC_WALLET = process.env.BITCOIN_RPC_WALLET || 'cashpay-btc';

const RPC_BASE_URL = `http://${RPC_HOST}:${RPC_PORT}`;

const RPC_WALLET_URL =
    `${RPC_BASE_URL}/wallet/${encodeURIComponent(RPC_WALLET)}`;

const AUTH_HEADER = `Basic ${Buffer.from(
    `${RPC_USER}:${RPC_PASSWORD}`
).toString('base64')}`;

interface RpcResponse {
    result: any;
    error: any;
    id: string;
}

/**
 * Erreur remontée par bitcoinRpcRequest.
 * - definitive = true  : le nœud a répondu explicitement par une erreur RPC.
 *   L'opération n'a pas été exécutée (aucun BTC envoyé).
 * - definitive = false : pas de réponse exploitable (réseau, timeout, HTTP
 *   inattendu). Le résultat est INCERTAIN : ne jamais rembourser sans vérifier.
 */
export interface BitcoinRpcFailure extends Error {
    definitive: boolean;
    rpcCode?: number;
}

function makeRpcFailure(
    message: string,
    definitive: boolean,
    rpcCode?: number
): BitcoinRpcFailure {
    const failure = new Error(message) as BitcoinRpcFailure;
    failure.definitive = definitive;
    failure.rpcCode = rpcCode;
    return failure;
}

async function bitcoinRpcRequest(
    method: string,
    params: any[] = []
): Promise<RpcResponse> {
    if (!RPC_USER || !RPC_PASSWORD) {
        throw makeRpcFailure(
            'Bitcoin RPC credentials are not configured in the .env file.',
            true
        );
    }

    const payload = {
        jsonrpc: '1.0',
        id: `cashpay-${Date.now()}`,
        method,
        params,
    };

    try {
        const response = await fetch(RPC_WALLET_URL, {
            method: 'POST',
            headers: {
                Authorization: AUTH_HEADER,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            cache: 'no-store',
        });

        let data: RpcResponse;

        try {
            data = await response.json();
        } catch {
            throw makeRpcFailure(
                `Bitcoin RPC '${method}': réponse illisible (HTTP ${response.status}).`,
                false
            );
        }

        if (data.error) {
            throw makeRpcFailure(
                `Bitcoin RPC error for ${method}: ` +
                `${data.error.message} (Code: ${data.error.code})`,
                true,
                Number(data.error.code)
            );
        }

        return data;
    } catch (error: any) {
        console.error(
            `[Bitcoin Service] RPC '${method}' failed:`,
            error
        );

        const definitive = error?.definitive === true;

        throw makeRpcFailure(
            `Failed to communicate with Bitcoin wallet: ${error?.message}`,
            definitive,
            error?.rpcCode
        );
    }
}

export async function getNewBitcoinAddress(
    label: string
): Promise<string> {
    const response = await bitcoinRpcRequest(
        'getnewaddress',
        [label, 'bech32']
    );

    return response.result;
}

export async function listBitcoinTransactions(
    count = 1000,
    skip = 0,
    includeWatchOnly = true
): Promise<any[]> {
    const response = await bitcoinRpcRequest(
        'listtransactions',
        [
            '*',
            count,
            skip,
            includeWatchOnly,
        ]
    );

    return Array.isArray(response.result)
        ? response.result
        : [];
}

export async function validateBitcoinAddress(
    address: string
): Promise<boolean> {
    if (typeof address !== 'string' || !address.trim()) {
        return false;
    }

    const response = await bitcoinRpcRequest(
        'validateaddress',
        [address.trim()]
    );

    return response.result?.isvalid === true;
}

/**
 * Solde dépensable (confirmé) du portefeuille du nœud, en BTC.
 * Sert à vérifier la liquidité AVANT de débiter un utilisateur.
 */
export async function getBitcoinWalletBalance(): Promise<number> {
    const response = await bitcoinRpcRequest(
        'getbalance',
        ['*', 1]
    );

    const balance = Number(response.result);

    if (!Number.isFinite(balance) || balance < 0) {
        throw new Error('Bitcoin Core returned an invalid wallet balance.');
    }

    return balance;
}

export async function sendBitcoinToAddress(
    recipientAddress: string,
    amount: number,
    /**
     * Référence enregistrée par le nœud avec la transaction (ex. la référence
     * CashPay). Elle permet de retrouver l'envoi si la base n'a pas pu être
     * finalisée : voir reconcileBitcoinWithdrawals.
     */
    comment?: string
): Promise<string> {
    if (!recipientAddress) {
        throw makeRpcFailure(
            'Bitcoin recipient address is required.',
            true
        );
    }

    // Bitcoin n'a pas plus de 8 décimales : on arrondit pour éviter
    // les notations flottantes (ex. 0.30000000000000004).
    const normalizedAmount = Number(Number(amount).toFixed(8));

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw makeRpcFailure(
            'Bitcoin amount must be greater than zero.',
            true
        );
    }

    // Portefeuille Bitcoin Core chiffré : on le déverrouille 30 s, le temps de
    // l'envoi (la phrase est lue dans l'environnement du serveur uniquement).
    const walletPassphrase = process.env.BITCOIN_RPC_WALLET_PASSPHRASE;

    if (walletPassphrase) {
        await bitcoinRpcRequest('walletpassphrase', [walletPassphrase, 30]);
    }

    const safeComment = comment
        ? String(comment).replace(/[^\w .:-]/g, '').slice(0, 100)
        : '';

    const response = await bitcoinRpcRequest(
        'sendtoaddress',
        [
            recipientAddress.trim(),
            normalizedAmount,
            ...(safeComment ? [safeComment] : []),
        ]
    );

    if (
        typeof response.result !== 'string' ||
        !response.result
    ) {
        throw new Error(
            'Bitcoin Core did not return a transaction hash.'
        );
    }

    return response.result;
}
