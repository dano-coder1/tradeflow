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
    return raw ? (JSON.parse(raw) as StoredAlert[]) : [];
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

export function extractNumericLevel(s: string | undefined | null): number | null {
  if (!s || s === "N/A") return null;
  const m = s.match(/\d[\d,]*\.?\d*/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(/,/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}
