// Décision de balayage d'une adresse de dépôt USDT : logique PURE (aucun réseau,
// aucune base de données) pour pouvoir la tester sans risque.
//
// Contexte : un dépôt USDT arrive sur l'adresse propre à l'utilisateur. Pour
// qu'il puisse être renvoyé ailleurs, il faut le ramener sur le portefeuille
// chaud. Un transfert TRC-20 consomme de l'énergie : l'adresse de dépôt a donc
// besoin d'un peu de TRX, que le portefeuille chaud lui avance.

export interface SweepPlanInput {
  /** USDT présents sur l'adresse (6 décimales, valeur brute). */
  usdtRaw: bigint;
  /** TRX présents sur l'adresse de dépôt, en SUN. */
  addressTrxSun: number;
  /** TRX disponibles sur le portefeuille chaud, en SUN. */
  hotTrxSun: number;
  /** Solde USDT minimal pour justifier un balayage (valeur brute). */
  minUsdtRaw: bigint;
  /** TRX minimal requis sur l'adresse pour payer le transfert, en SUN. */
  minAddressTrxSun: number;
  /** TRX à atteindre quand on recharge l'adresse, en SUN. */
  topUpTargetSun: number;
  /** TRX à toujours garder sur le portefeuille chaud, en SUN. */
  hotReserveSun: number;
}

export type SweepPlan =
  | { action: 'skip'; reason: 'below_minimum' | 'hot_wallet_low_trx' }
  | { action: 'topup'; amountSun: number }
  | { action: 'sweep' };

export function planSweep(input: SweepPlanInput): SweepPlan {
  if (input.usdtRaw < input.minUsdtRaw) {
    return { action: 'skip', reason: 'below_minimum' };
  }

  if (input.addressTrxSun >= input.minAddressTrxSun) {
    return { action: 'sweep' };
  }

  const amountSun = Math.max(
    input.topUpTargetSun - input.addressTrxSun,
    input.minAddressTrxSun - input.addressTrxSun,
  );

  // Ne jamais vider le portefeuille chaud : il doit pouvoir payer les retraits.
  if (input.hotTrxSun - amountSun < input.hotReserveSun) {
    return { action: 'skip', reason: 'hot_wallet_low_trx' };
  }

  return { action: 'topup', amountSun };
}
