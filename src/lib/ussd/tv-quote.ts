import { db } from "@/lib/db";
import { countryToCode } from "@/lib/utils";
export async function tvQuote(user: any, packageId: number, currency: string) {
  const pkg = (
    await db.query(
      "SELECT * FROM tv_subscription_fees WHERE id=$1 AND is_active=TRUE",
      [packageId],
    )
  ).rows[0];
  if (!pkg) throw Error("Forfait TV indisponible.");
  const meta =
    typeof pkg.metadata === "string"
      ? JSON.parse(pkg.metadata)
      : pkg.metadata || {};
  const tariff = Number(pkg.base_price ?? meta.price ?? pkg.price_usd),
    source = String(pkg.base_currency || meta.currency || "USD")
      .trim()
      .toUpperCase();
  if (
    !Number.isFinite(tariff) ||
    tariff <= 0 ||
    !new RegExp("^[A-Z]{3}$").test(source) ||
    !new RegExp("^[A-Z]{3}$").test(currency)
  )
    throw Error("Tarif ou devise TV invalide.");
  let rate = 1;
  if (source !== currency) {
    const rows = (
      await db.query(
        "SELECT rate FROM exchange_rates WHERE country_code=$1 AND from_currency=$2 AND to_currency=$3",
        [countryToCode(user.country) || "GBL", source, currency],
      )
    ).rows;
    if (rows.length !== 1)
      throw Error(`Taux ${source}/${currency} indisponible.`);
    rate = Number(rows[0].rate);
    if (!Number.isFinite(rate) || rate <= 0)
      throw Error("Taux de change invalide.");
  }
  const amount = Math.round(tariff * rate * 100) / 100;
  if (amount <= 0) throw Error("Montant TV invalide.");
  return {
    amount,
    currency,
    tariff,
    tariffCurrency: source,
    packageName: pkg.package_name,
  };
}
