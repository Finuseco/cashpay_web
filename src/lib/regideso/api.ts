const BASE_URL = process.env.REGIDESO_API_URL?.replace(/\/+$/, '');
const API_KEY = process.env.REGIDESO_API_TOKEN;

export const REGIDESO_PROVINCES = [
  'KIN', 'KC', 'KAT', 'NK', 'SK', 'MB', 'KAN',
] as const;

export type RegidesoProvince =
  (typeof REGIDESO_PROVINCES)[number];

function getConfig() {
  if (!BASE_URL || !API_KEY) {
    throw new Error(
      'Configuration API REGIDESO manquante côté serveur.'
    );
  }

  return { baseUrl: BASE_URL, apiKey: API_KEY };
}

async function regidesoRequest(
  path: string,
  init: RequestInit = {}
) {
  const { baseUrl, apiKey } = getConfig();

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...init.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.message === 'string'
        ? data.message
        : `Erreur API REGIDESO (${response.status}).`
    );
  }

  return data;
}

export async function getRegidesoInvoices(
  refClient: string,
  province: RegidesoProvince = 'KIN'
) {
  const params = new URLSearchParams({
    ref_client: refClient,
    province,
  });

  return regidesoRequest(
    `/api/factures?${params.toString()}`,
    { method: 'GET' }
  );
}

export async function verifyRegidesoTransaction(
  numAcquit: string,
  province: RegidesoProvince = 'KIN'
) {
  const params = new URLSearchParams({
    num_acquit: numAcquit,
    province,
  });

  return regidesoRequest(
    `/api/transactionId?${params.toString()}`,
    { method: 'GET' }
  );
}
