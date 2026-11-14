/** Read both the current fee string and legacy single-component flat/percent tiers. Never invent a rate. */
export function feeValue(tier: any): string {
  let value: unknown = tier.fee;
  if (value === undefined) {
    if (tier.flat !== undefined && Number(tier.percent ?? 0) === 0)
      value = tier.flat;
    else if (tier.percent !== undefined && Number(tier.flat ?? 0) === 0)
      value = `${tier.percent}%`;
  }
  const raw = String(value).trim();
  if (
    !/^\d+(?:\.\d+)?%?$/.test(raw) ||
    !Number.isFinite(Number(raw.replace("%", "")))
  )
    throw Error("Palier de frais invalide.");
  return raw;
}
