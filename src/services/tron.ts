import { TronWeb } from 'tronweb';

// Module serveur uniquement (jamais importé par un composant client).

const FULL_HOST = process.env.TRON_FULL_HOST;
const API_KEY = process.env.TRON_API_KEY;
const PRIVATE_KEY = process.env.TRON_PRIVATE_KEY;

/**
 * Contrat USDT (TRC-20). Sans variable USDT_TRC20_CONTRACT, on choisit selon le
 * réseau de TRON_FULL_HOST :
 *  - hôte "nile"  -> contrat USDT du réseau de test Nile ;
 *  - sinon        -> contrat USDT OFFICIEL du réseau principal (mainnet).
 */
function defaultUsdtContract(): string {
  const host = (process.env.TRON_FULL_HOST || '').toLowerCase();

  return host.includes('nile')
    ? 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj'
    : 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
}

export const USDT_TRC20_CONTRACT =
  process.env.USDT_TRC20_CONTRACT || defaultUsdtContract();

/**
 * Levée quand la conservation sécurisée des clés n'est pas configurée
 * (variable TRON_HD_MNEMONIC absente). Aucune adresse n'est alors créée.
 */
export class UsdtNotConfiguredError extends Error {
  code = 'SECURE_KEY_CUSTODY_NOT_CONFIGURED';

  constructor() {
    super('TRON_HD_MNEMONIC non configurée : création d’adresse suspendue.');
    this.name = 'UsdtNotConfiguredError';
  }
}

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

/**
 * Adresse TRON au format Base58 ("T…", 34 caractères) uniquement.
 * Refuse le format hexadécimal et les adresses fictives.
 */
export function isBase58TronAddress(address: unknown): boolean {
  return (
    typeof address === 'string' &&
    /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) &&
    validateTronAddress(address)
  );
}

/**
 * Adresse de dépôt USDT d'un utilisateur, dérivée d'un portefeuille HD
 * (BIP-44, chemin m/44'/195'/0'/0/<userId>) à partir de TRON_HD_MNEMONIC.
 *
 * - Aucune clé privée n'est enregistrée en base : elle se recalcule à la demande.
 * - La phrase TRON_HD_MNEMONIC doit exister UNIQUEMENT dans l'environnement du
 *   serveur (jamais dans le dépôt Git) et être sauvegardée hors ligne.
 * - L'index 0 est réservé : les utilisateurs commencent à 1.
 */
/**
 * Clé privée dérivée d'un utilisateur. USAGE INTERNE (balayage des dépôts) :
 * ne jamais l'enregistrer, l'afficher ni la renvoyer dans une réponse.
 */
function deriveUserTronPrivateKey(userId: number): string {
  const mnemonic = process.env.TRON_HD_MNEMONIC?.trim();

  if (!mnemonic) {
    throw new UsdtNotConfiguredError();
  }

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Utilisateur invalide pour la dérivation d’adresse TRON.');
  }

  const wallet = (TronWeb as any).fromMnemonic(
    mnemonic,
    `m/44'/195'/0'/0/${userId}`,
  );

  const privateKey = String(wallet?.privateKey ?? '').replace(/^0x/i, '');

  if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('Dérivation de la clé TRON impossible.');
  }

  return privateKey;
}

export function deriveUserTronAddress(userId: number): string {
  const privateKey = deriveUserTronPrivateKey(userId);

  const address = (TronWeb as any).address.fromPrivateKey(privateKey);

  if (!isBase58TronAddress(address)) {
    throw new Error('Adresse TRON dérivée invalide.');
  }

  return address;
}

export function getHotWalletAddress(): string {
  if (!PRIVATE_KEY) {
    throw new Error('TRON_PRIVATE_KEY non configurée.');
  }

  const address = (TronWeb as any).address.fromPrivateKey(
    PRIVATE_KEY.replace(/^0x/i, ''),
  );

  if (!isBase58TronAddress(address)) {
    throw new Error('TRON_PRIVATE_KEY invalide.');
  }

  return address;
}

export async function getTronUsdtBalance(address: string) {
  if (!validateTronAddress(address)) {
    throw new Error('Adresse TRON invalide.');
  }

  const tronWeb = getTronWeb();

  // Une lecture de contrat a besoin d'une adresse "appelante" par défaut.
  if (!PRIVATE_KEY) {
    tronWeb.setAddress(address);
  }

  const contract = await tronWeb.contract().at(USDT_TRC20_CONTRACT);
  const rawBalance = await contract.balanceOf(address).call();

  return {
    address,
    currency: 'USDT_TRC20',
    balance: Number(rawBalance.toString()) / 1_000_000,
  };
}

/**
 * Liquidité du portefeuille chaud qui paie les retraits externes :
 * USDT disponibles et TRX (énergie/bande passante).
 */
export async function getTronHotWalletStatus() {
  const address = getHotWalletAddress();
  const tronWeb = getTronWeb();

  const { balance: usdt } = await getTronUsdtBalance(address);
  const sun = await tronWeb.trx.getBalance(address);

  return {
    address,
    usdt,
    trx: Number(sun) / 1_000_000,
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

  // Plafond de TRX pouvant être brûlé pour l'énergie de ce transfert.
  const feeLimit = Number(process.env.TRON_FEE_LIMIT_SUN) || 100_000_000;

  const tronWeb = getTronWeb();
  const contract = await tronWeb.contract().at(USDT_TRC20_CONTRACT);
  const result = await contract.transfer(
    recipientAddress,
    rawAmount,
  ).send({ feeLimit, shouldPollResponse: false });

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

/**
 * 'success'   : exécutée avec succès.
 * 'failed'    : exécutée mais échouée (rien n'a été transféré).
 * 'not_found' : le nœud répond, mais ne connaît pas (encore) cette transaction.
 * 'unknown'   : nœud injoignable / réponse inexploitable (ne JAMAIS rembourser).
 */
export type TronTxOutcome = 'success' | 'failed' | 'not_found' | 'unknown';

/** Résultat on-chain d'une transaction déjà diffusée (une seule lecture). */
export async function getTronTransactionOutcome(
  txid: string,
): Promise<TronTxOutcome> {
  try {
    const tronWeb = getTronWeb();
    const info: any = await tronWeb.trx.getTransactionInfo(txid);

    if (info && info.id) {
      const receiptResult = info.receipt?.result;

      if (
        info.result === 'FAILED' ||
        (receiptResult && receiptResult !== 'SUCCESS')
      ) {
        return 'failed';
      }

      return 'success';
    }

    // Réponse valide mais vide : transaction pas (ou pas encore) dans un bloc.
    return 'not_found';
  } catch {
    // Nœud injoignable un instant : résultat inconnu.
    return 'unknown';
  }
}

/** Attend le résultat on-chain jusqu'à l'échéance (TRON : un bloc ≈ 3 s). */
export async function waitForTronTransaction(
  txid: string,
  timeoutMs = 24_000,
): Promise<TronTxOutcome> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3_000));

    const outcome = await getTronTransactionOutcome(txid);

    if (outcome === 'success' || outcome === 'failed') {
      return outcome;
    }
  }

  return 'unknown';
}

/* -------------------------------------------------------------------------- */
/* Retrait : signer D'ABORD (le TXID est connu avant la diffusion)            */
/* -------------------------------------------------------------------------- */

export interface SignedTronTransfer {
  txid: string;
  signedTransaction: unknown;
}

/**
 * Construit et signe le transfert USDT depuis le portefeuille chaud, SANS le
 * diffuser. Le TXID d'une transaction TRON est connu dès la signature : on peut
 * donc l'enregistrer en base AVANT l'envoi et toujours retrouver ce que le
 * réseau en a fait, même en cas de coupure au mauvais moment.
 *
 * Lève une erreur si la transaction n'est pas valide (solde, adresse…) :
 * dans ce cas rien n'a été diffusé.
 */
export async function buildSignedUsdtTransfer(
  recipientAddress: string,
  amount: number,
): Promise<SignedTronTransfer> {
  if (!isBase58TronAddress(recipientAddress)) {
    throw new Error('Adresse TRON destinataire invalide.');
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Montant USDT invalide.');
  }

  if (!PRIVATE_KEY) {
    throw new Error('TRON_PRIVATE_KEY non configurée.');
  }

  const rawAmount = BigInt(Math.round(Number(amount.toFixed(6)) * 1_000_000));

  if (rawAmount <= 0n) {
    throw new Error('Montant USDT trop faible.');
  }

  const feeLimit = Number(process.env.TRON_FEE_LIMIT_SUN) || 100_000_000;
  const tronWeb = getTronWeb();
  const from = getHotWalletAddress();

  const built: any = await tronWeb.transactionBuilder.triggerSmartContract(
    USDT_TRC20_CONTRACT,
    'transfer(address,uint256)',
    { feeLimit, callValue: 0 },
    [
      { type: 'address', value: recipientAddress },
      { type: 'uint256', value: rawAmount.toString() },
    ],
    from,
  );

  if (!built?.result?.result || !built?.transaction) {
    throw new Error(
      `CONTRACT_VALIDATE_ERROR: transfert USDT refusé à la simulation (${String(
        built?.result?.message ?? 'sans détail',
      )}).`,
    );
  }

  const signed: any = await tronWeb.trx.sign(
    built.transaction,
    PRIVATE_KEY.replace(/^0x/i, ''),
  );

  if (!signed?.txID || !signed?.signature) {
    throw new Error('Signature de la transaction TRON impossible.');
  }

  return { txid: String(signed.txID), signedTransaction: signed };
}

export type TronBroadcastStatus = 'accepted' | 'rejected' | 'unknown';

/**
 * Diffuse une transaction déjà signée.
 *  - 'accepted' : le nœud l'a prise en charge (ou la connaissait déjà).
 *  - 'rejected' : le nœud l'a REFUSÉE explicitement -> rien n'est parti.
 *  - 'unknown'  : pas de réponse exploitable -> résultat incertain, à vérifier
 *                 avec le TXID (ne jamais rembourser sans vérifier).
 */
export async function broadcastSignedTronTransaction(
  signedTransaction: unknown,
): Promise<{ status: TronBroadcastStatus; detail?: string }> {
  try {
    const tronWeb = getTronWeb();
    const response: any = await tronWeb.trx.sendRawTransaction(
      signedTransaction as any,
    );

    if (response?.result === true) {
      return { status: 'accepted' };
    }

    // Déjà connue du réseau : elle suivra son cours normal.
    if (response?.code === 'DUP_TRANSACTION_ERROR') {
      return { status: 'accepted' };
    }

    return {
      status: 'rejected',
      detail: JSON.stringify({
        code: response?.code,
        message: response?.message,
      }),
    };
  } catch (error: any) {
    return { status: 'unknown', detail: String(error?.message ?? error) };
  }
}

/* -------------------------------------------------------------------------- */
/* Balayage des dépôts vers le portefeuille chaud                             */
/* -------------------------------------------------------------------------- */

/** Solde USDT brut (6 décimales) d'une adresse, sans arrondi. */
export async function getTronUsdtRawBalance(address: string): Promise<bigint> {
  if (!isBase58TronAddress(address)) {
    throw new Error('Adresse TRON invalide.');
  }

  const tronWeb = getTronWeb();

  if (!PRIVATE_KEY) {
    tronWeb.setAddress(address);
  }

  const contract = await tronWeb.contract().at(USDT_TRC20_CONTRACT);
  const raw = await contract.balanceOf(address).call();

  return BigInt(raw.toString());
}

/** Solde TRX d'une adresse, en SUN (1 TRX = 1 000 000 SUN). */
export async function getTrxBalanceSun(address: string): Promise<number> {
  const tronWeb = getTronWeb();

  return Number(await tronWeb.trx.getBalance(address));
}

/** Envoie du TRX depuis le portefeuille chaud (pour payer l'énergie d'un balayage). */
export async function sendTrxFromHotWallet(
  toAddress: string,
  amountSun: number,
): Promise<string> {
  if (!isBase58TronAddress(toAddress)) {
    throw new Error('Adresse TRON invalide.');
  }

  if (!PRIVATE_KEY) {
    throw new Error('TRON_PRIVATE_KEY non configurée.');
  }

  if (!Number.isSafeInteger(amountSun) || amountSun <= 0) {
    throw new Error('Montant TRX invalide.');
  }

  const tronWeb = getTronWeb();
  const result: any = await tronWeb.trx.sendTransaction(
    toAddress,
    amountSun,
    PRIVATE_KEY.replace(/^0x/i, ''),
  );

  if (!result?.result || !result?.txid) {
    throw new Error(
      `Envoi de TRX refusé : ${JSON.stringify(result?.code ?? result)}`,
    );
  }

  return String(result.txid);
}

/**
 * Transfère TOUT le solde USDT d'une adresse de dépôt vers le portefeuille
 * chaud. La clé de l'adresse est recalculée à la volée (jamais stockée).
 * L'opération est sans état : si elle échoue, le prochain passage réessaie
 * à partir du solde réel de l'adresse.
 */
export async function sweepUsdtToHotWallet(
  userId: number,
  rawAmount: bigint,
): Promise<string> {
  if (rawAmount <= 0n) {
    throw new Error('Rien à balayer.');
  }

  if (!FULL_HOST) {
    throw new Error('TRON_FULL_HOST non configuré.');
  }

  const hotAddress = getHotWalletAddress();
  const feeLimit = Number(process.env.USDT_SWEEP_FEE_LIMIT_SUN) || 15_000_000;

  const userTronWeb = new TronWeb({
    fullHost: FULL_HOST,
    ...(API_KEY ? { headers: { 'TRON-PRO-API-KEY': API_KEY } } : {}),
    privateKey: deriveUserTronPrivateKey(userId),
  });

  const contract = await userTronWeb.contract().at(USDT_TRC20_CONTRACT);
  const result = await contract
    .transfer(hotAddress, rawAmount.toString())
    .send({ feeLimit, shouldPollResponse: false });

  const txid =
    typeof result === 'string'
      ? result
      : (result as { txid?: string }).txid;

  if (!txid) {
    throw new Error('Balayage diffusé sans TXID exploitable.');
  }

  return txid;
}
