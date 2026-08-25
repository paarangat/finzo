import type { Store } from "./db";

/**
 * Free mutual-fund pricing from mfapi.in (a JSON mirror of AMFI's official
 * daily NAV feed). No auth, no personal data leaves the machine — requests
 * carry only public scheme names/codes.
 */

const TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // offline or feed down — pricing just stays stale
  }
}

const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean));

/** Share of the query's tokens found in the candidate (0..1). Plan variants (direct/regular, growth/idcw) count like any token. */
export function schemeMatchScore(query: string, candidate: string): number {
  const q = tokens(query);
  if (q.size === 0) return 0;
  const c = tokens(candidate);
  let hit = 0;
  for (const t of q) if (c.has(t)) hit++;
  return hit / q.size;
}

/** Best AMFI scheme code for a CAS scheme name; null when nothing matches confidently. */
export async function findSchemeCode(name: string): Promise<number | null> {
  const data = (await getJson(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(name)}`)) as
    | { schemeCode: number; schemeName: string }[]
    | null;
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  const scored = data
    .map((d) => ({ code: d.schemeCode, score: schemeMatchScore(name, d.schemeName) }))
    .sort((a, b) => b.score - a.score);
  return scored[0].score >= 0.6 ? scored[0].code : null;
}

export async function latestNav(schemeCode: number): Promise<number | null> {
  const data = (await getJson(`https://api.mfapi.in/mf/${schemeCode}/latest`)) as
    | { data?: { nav?: string }[] }
    | null;
  const nav = Number(data?.data?.[0]?.nav);
  return Number.isFinite(nav) && nav > 0 ? nav : null;
}

/** Reprice every NAV-tracked holding (has scheme_code + units). Returns how many rows updated. */
export async function refreshNavValues(db: Store): Promise<number> {
  const rows = db.investments().filter((r) => r.scheme_code !== null && r.units !== null);
  const results = await Promise.all(
    rows.map(async (r) => {
      const nav = await latestNav(r.scheme_code!);
      if (nav === null) return false;
      db.updateInvestment(r.id, { value: Math.round(r.units! * nav * 100) });
      return true;
    })
  );
  return results.filter(Boolean).length;
}
