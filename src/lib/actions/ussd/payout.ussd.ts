// ============================================================
// CashPay All — PAYOUT USSD
// Fichier : src/lib/actions/ussd/payout.ussd.ts
// ============================================================

export type UssdPayoutData = {
  operator?: string;
  phone?: string;
  amount?: number;
  fee?: number;
  total?: number;
  currency?: string;
};

// ============================================================
// OPÉRATEURS
// ============================================================

export const USSD_PAYOUT_OPERATORS: Record<string, string> = {
  '1': 'Vodacom M-Pesa',
  '2': 'Orange Money',
  '3': 'Airtel Money',
  '4': 'Africell Money',
  '5': 'MTN Mobile Money',
};

// ============================================================
// MENU : PAYOUT
// ============================================================

export function payoutMenu(): string {
  return [
    'PAIEMENT SORTANT',
    '',
    'Choisissez votre opérateur :',
    '',
    '1. Vodacom M-Pesa',
    '2. Orange Money',
    '3. Airtel Money',
    '4. Africell Money',
    '5. MTN Mobile Money',
    '',
    '0. Retour',
  ].join('\n');
}

// ============================================================
// MENU : OPÉRATEUR
// ============================================================

export function getUssdPayoutOperator(choice: string): string | null {
  return USSD_PAYOUT_OPERATORS[choice] ?? null;
}

// ============================================================
// MENU : NUMÉRO DE TÉLÉPHONE
// ============================================================

export function payoutPhoneMenu(operator: string): string {
  return [
    'PAIEMENT SORTANT',
    '',
    `Opérateur : ${operator}`,
    '',
    'Entrez le numéro Mobile Money',
    'du bénéficiaire :',
    '',
    '0. Retour',
  ].join('\n');
}

// ============================================================
// MENU : MONTANT
// ============================================================

export function payoutAmountMenu(
  operator: string,
  phone: string,
): string {
  return [
    'PAIEMENT SORTANT',
    '',
    `Opérateur : ${operator}`,
    `Numéro : ${phone}`,
    '',
    'Entrez le montant à envoyer :',
    '',
    'Exemple : 10000',
    '',
    '0. Retour',
  ].join('\n');
}

// ============================================================
// CALCUL DES FRAIS
// ============================================================

export function calculateUssdPayoutFee(amount: number): number {
  // Barème provisoire.
  // À remplacer par le barème officiel CashPay.
  return Math.round(amount * 0.02 * 100) / 100;
}

// ============================================================
// MENU : CONFIRMATION
// ============================================================

export function payoutConfirmationMenu(
  data: Required<UssdPayoutData>,
): string {
  return [
    'CONFIRMATION DU PAIEMENT',
    '',
    `Opérateur : ${data.operator}`,
    `Numéro : ${data.phone}`,
    '',
    `Montant : ${data.amount.toFixed(2)} ${data.currency}`,
    `Frais : ${data.fee.toFixed(2)} ${data.currency}`,
    `Total : ${data.total.toFixed(2)} ${data.currency}`,
    '',
    '1. Confirmer',
    '0. Annuler',
  ].join('\n');
}

// ============================================================
// SERVICE NON DISPONIBLE
// ============================================================

export function payoutUnavailableMenu(): string {
  return [
    'SERVICE NON DISPONIBLE',
    '',
    'Le paiement sortant vers Mobile Money',
    'est actuellement indisponible.',
    '',
    'Ce service sera bientôt disponible.',
    '',
    'Veuillez revenir plus tard.',
    '',
    '0. Retour',
  ].join('\n');
}

// ============================================================
// VALIDATION DU NUMÉRO
// ============================================================

export function validateUssdPayoutPhone(phone: string): boolean {
  const normalized = phone.replace(/\s+/g, '');

  return /^0\d{9}$/.test(normalized);
}

// ============================================================
// VALIDATION DU MONTANT
// ============================================================

export function validateUssdPayoutAmount(amount: string): boolean {
  const value = Number(amount.replace(',', '.'));

  return Number.isFinite(value) && value > 0;
}

// ============================================================
// PRÉPARATION DE LA CONFIRMATION
// ============================================================

export function prepareUssdPayout(
  operator: string,
  phone: string,
  amount: number,
  currency: string,
): UssdPayoutData {
  const fee = calculateUssdPayoutFee(amount);

  return {
    operator,
    phone,
    amount,
    fee,
    total: amount + fee,
    currency,
  };
}
