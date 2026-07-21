
'use server';

/**
 * @fileoverview A service for interacting with a Bitcoin Core node via JSON-RPC.
 */

const RPC_USER = process.env.BITCOIN_RPC_USER;
const RPC_PASSWORD = process.env.BITCOIN_RPC_PASSWORD;
const RPC_HOST = process.env.BITCOIN_RPC_HOST || '127.0.0.1';
const RPC_PORT = process.env.BITCOIN_RPC_PORT || '8332';

const RPC_URL = `http://${RPC_HOST}:${RPC_PORT}`;
const AUTH_HEADER = `Basic ${Buffer.from(`${RPC_USER}:${RPC_PASSWORD}`).toString('base64')}`;

interface RpcResponse {
    result: any;
    error: any;
    id: string;
}

/**
 * Sends a generic JSON-RPC request to the Bitcoin Core node.
 * @param method The RPC method to call (e.g., 'getnewaddress').
 * @param params An array of parameters for the RPC method.
 * @returns A promise that resolves with the RPC response.
 */
async function bitcoinRpcRequest(method: string, params: any[] = []): Promise<RpcResponse> {
    if (!RPC_USER || !RPC_PASSWORD) {
        const errorMsg = 'Bitcoin RPC credentials are not configured in the .env file.';
        console.error(`[Bitcoin Service] ${errorMsg}`);
        throw new Error(errorMsg);
    }
    
    const payload = {
        jsonrpc: '1.0',
        id: `cashpay-${Date.now()}`,
        method: method,
        params: params,
    };

    try {
        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            cache: 'no-store',
        });

        const data: RpcResponse = await response.json();

        if (data.error) {
            throw new Error(`Bitcoin RPC error for method ${method}: ${data.error.message} (Code: ${data.error.code})`);
        }

        return data;

    } catch (error: any) {
        console.error(`[Bitcoin Service] Failed to execute RPC method '${method}':`, error);
        // This could be a network error or an error from the RPC itself.
        throw new Error(`Failed to communicate with Bitcoin node: ${error.message}`);
    }
}

/**
 * Generates a new Bitcoin address for a user.
 * This should be a unique address for each deposit.
 * @param label The label to associate with the address, typically the user's ID.
 * @returns A promise that resolves with the new Bitcoin address string.
 */
export async function getNewBitcoinAddress(label: string): Promise<string> {
    try {
        // 'bech32' is the modern address type (bc1...). 
        const response = await bitcoinRpcRequest('getnewaddress', [label, 'bech32']);
        return response.result;
    } catch (error) {
        console.error("Error generating new Bitcoin address:", error);
        // Fallback or re-throw depending on desired error handling
        throw error;
    }
}
