// Client-side price alert store (localStorage)

export interface StoredAlert {
  id: string;
  symbol: string;
  level: number;
  label: string;
  direction: "BUY" | "SELL" | "NEUTRAL";
  analysisId: string;
  createdAt: string;
}

const STORAGE_KEY = "tf_price_alerts";

export function getAlerts(): StoredAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as StoredAlert[];
    // Only keep Entry alerts (clean up legacy SL/TP alerts)
    const entryOnly = all.filter((a) => a.label === "Entry");
    if (entryOnly.length !== all.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entryOnly));
    }
    return entryOnly;
  } catch {
    return [];
  }
}

export function addAlerts(alerts: StoredAlert[]) {
  const existing = getAlerts();
  // Deduplicate by symbol+level
  const keys = new Set(existing.map((a) => `${a.symbol}_${a.level}`));
  const toAdd = alerts.filter((a) => !keys.has(`${a.symbol}_${a.level}`));
  const merged = [...existing, ...toAdd];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {}
  window.dispatchEvent(new CustomEvent("tf:alerts-changed"));
}

export function removeAlert(id: string) {
  const alerts = getAlerts().filter((a) => a.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {}
  window.dispatchEvent(new CustomEvent("tf:alerts-changed"));
}

export function clearAlerts() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent("tf:alerts-changed"));
}

/** Extract a plausible price level from a string. Finds ALL numbers and returns
 *  the largest one >= 100 (real prices are never < 100 for instruments we track). */
export function extractNumericLevel(s: string | undefined | null): number | null {
  if (!s || s === "N/A") return null;
  const matches = s.match(/\d[\d,]*\.?\d*/g);
  if (!matches) return null;
  let best: number | null = null;
  for (const m of matches) {
    const n = parseFloat(m.replace(/,/g, ""));
    if (!isFinite(n) || n < 100) continue;
    if (best === null || n > best) best = n;
  }
  return best;
}

/** Extract all numbers >= 100 from a string */
function allNumbers(s: string | undefined | null): number[] {
  if (!s || s === "N/A") return [];
  const matches = s.match(/\d[\d,]*\.?\d*/g);
  if (!matches) return [];
  return matches
    .map((m) => parseFloat(m.replace(/,/g, "")))
    .filter((n) => isFinite(n) && n >= 100);
}

/** Try to find the actual entry price from structured analysis fields.
 *  Priority: decision_zone numbers → sniper_entry numbers.
 *  Excludes SL value. Picks the candidate between SL and TP1. */
export function extractEntryPrice(result: {
  bias?: string;
  sniper_entry?: string;
  decision_zone?: string;
  sl?: string;
  tp1?: string;
}): number | null {
  const slValue = extractNumericLevel(result.sl);
  const tp1Value = extractNumericLevel(result.tp1);

  // Collect candidates from decision_zone first (most reliable), then sniper_entry
  const candidates = [
    ...allNumbers(result.decision_zone),
    ...allNumbers(result.sniper_entry),
  ];

  // Remove duplicates and exclude SL
  const unique = [...new Set(candidates)].filter((n) => {
    if (slValue && Math.abs(n - slValue) < 0.01) return false;
    return true;
  });

  console.log("[extractEntryPrice] candidates:", unique, "SL:", slValue, "TP1:", tp1Value, "bias:", result.bias);

  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0];

  // If we have SL and TP1, pick the candidate that falls between them
  if (slValue && tp1Value) {
    const lo = Math.min(slValue, tp1Value);
    const hi = Math.max(slValue, tp1Value);
    const between = unique.filter((n) => n > lo && n < hi);
    if (between.length > 0) {
      // Pick the one closest to the midpoint
      const mid = (lo + hi) / 2;
      between.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
      return between[0];
    }
  }

  // Fallback: for bullish entry < TP1, for bearish entry > TP1
  if (tp1Value) {
    const isBullish = result.bias === "bullish";
    const valid = unique.filter((n) =>
      isBullish ? n < tp1Value : n > tp1Value
    );
    if (valid.length > 0) return valid[0];
  }

  // Last resort: smallest candidate that isn't SL (likely the zone low)
  return unique[0];
}
