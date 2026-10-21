import { TronWeb } from 'tronweb';

const FULL_HOST = process.env.TRON_FULL_HOST;
const API_KEY = process.env.TRON_API_KEY;
const PRIVATE_KEY = process.env.TRON_PRIVATE_KEY;

export const USDT_TRC20_CONTRACT =
  process.env.USDT_TRC20_CONTRACT ||
  'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj';

function getTronWeb() {
  if (!FULL_HOST) {
    throw new Error('TRON_FULL_HOST non configuré.');
  }

  return new TronWeb({
    fullHost: FULL_HOST,
    ...(API_KEY ? { headers: { 'TRON-PRO-API-KEY': API_KEY } } : {}),
    ...(PRIVATE_KEY ? { privateKey: PRIVATE_KEY } : {}),
  });
}

export function validateTronAddress(address: string): boolean {
  try {
    return TronWeb.isAddress(address);
  } catch {
    return false;
  }
}

export async function getTronUsdtBalance(address: string) {
  if (!validateTronAddress(address)) {
    throw new Error('Adresse TRON invalide.');
  }

  const tronWeb = getTronWeb();
  const contract = await tronWeb.contract().at(USDT_TRC20_CONTRACT);
  const rawBalance = await contract.balanceOf(address).call();

  return {
    address,
    currency: 'USDT_TRC20',
    balance: Number(rawBalance.toString()) / 1_000_000,
  };
}

export async function sendTronUsdt(
  recipientAddress: string,
  amount: number,
) {
  if (!validateTronAddress(recipientAddress)) {
    throw new Error('Adresse TRON destinataire invalide.');
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Montant USDT invalide.');
  }

  if (!PRIVATE_KEY) {
    throw new Error('TRON_PRIVATE_KEY non configurée.');
  }

  const rawAmount = Math.round(amount * 1_000_000);

  if (rawAmount <= 0) {
    throw new Error('Montant USDT trop faible.');
  }

  const tronWeb = getTronWeb();
  const contract = await tronWeb.contract().at(USDT_TRC20_CONTRACT);
  const result = await contract.transfer(
    recipientAddress,
    rawAmount,
  ).send();

  const txid =
    typeof result === 'string'
      ? result
      : (result as { txid?: string }).txid;

  if (!txid) {
    throw new Error(
      'Transaction TRON envoyée sans TXID exploitable. Vérification requise.',
    );
  }

  return { txid, currency: 'USDT_TRC20', status: 'broadcasted' };
}
