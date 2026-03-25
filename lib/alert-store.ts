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

/** Try multiple analysis fields in priority order to find a valid entry price. */
export function extractEntryPrice(result: {
  sniper_entry?: string;
  decision_zone?: string;
  sl?: string;
  tp1?: string;
}): number | null {
  // 1. sniper_entry — the primary entry field
  const fromEntry = extractNumericLevel(result.sniper_entry);
  if (fromEntry) return fromEntry;

  // 2. decision_zone — often contains "3020-3030" range, take the first valid price
  const fromZone = extractNumericLevel(result.decision_zone);
  if (fromZone) return fromZone;

  // 3. Fallback: derive from SL/TP midpoint if both exist
  const sl = extractNumericLevel(result.sl);
  const tp = extractNumericLevel(result.tp1);
  if (sl && tp) return Math.round(((sl + tp) / 2) * 100) / 100;

  return null;
}
