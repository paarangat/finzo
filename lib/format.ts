/** Indian-style grouping (₹2,31,311.40) for INR; Western grouping otherwise. */
const localeFor = (currency: string) => (currency === "INR" ? "en-IN" : "en");

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat(localeFor(currency), { style: "currency", currency }).format(minor / 100);
}

/** "₹45,000" — whole units, for targets and tight tiles where paise are noise. */
export function formatMoneyWhole(minor: number, currency: string): string {
  return new Intl.NumberFormat(localeFor(currency), { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
}

/** "₹87K" — for chart labels that must stay short. */
export function formatMoneyCompact(minor: number, currency: string): string {
  return new Intl.NumberFormat(localeFor(currency), {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(minor / 100);
}

/** "2026-07" -> "July 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1)).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "2026-07-14" -> "Jul 14" */
export function formatDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "2026-07-14" -> "Jul 14, 2026" */
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Percent change from prev to current, rounded to whole percent. null when there is nothing to compare against. */
export function delta(current: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((current - prev) / prev) * 100);
}
