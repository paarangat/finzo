export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(minor / 100);
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
