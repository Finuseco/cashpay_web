'use server';

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

async function bitcoinRpcRequest(
    method: string,
    params: any[] = []
): Promise<RpcResponse> {
    if (!RPC_USER || !RPC_PASSWORD) {
        throw new Error(
            'Bitcoin RPC credentials are not configured in the .env file.'
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

        const data: RpcResponse = await response.json();

        if (data.error) {
            throw new Error(
                `Bitcoin RPC error for ${method}: ` +
                `${data.error.message} (Code: ${data.error.code})`
            );
        }

        return data;
    } catch (error: any) {
        console.error(
            `[Bitcoin Service] RPC '${method}' failed:`,
            error
        );

        throw new Error(
            `Failed to communicate with Bitcoin wallet: ${error.message}`
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


export async function listBitcoinTransactions(count = 1000, skip = 0, includeWatchOnly = true): Promise<any[]> {
    const response = await bitcoinRpcRequest("listtransactions", ["*", count, skip, includeWatchOnly]);
    return Array.isArray(response.result) ? response.result : [];
}
