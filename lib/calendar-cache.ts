/**
 * Monthly calendar event cache backed by localStorage.
 *
 * Keys:   tf:calendar-events:YYYY-MM
 * Values: { fetchedAt: number, events: MarketEvent[] }
 *
 * Stale after 6 hours for the current month, never for past months.
 */

export interface MarketEvent {
  id: string;
  title: string;
  time: string;
  impact: "low" | "medium" | "high";
  currency: string;
}

interface CachedMonth {
  fetchedAt: number;
  events: MarketEvent[];
}

const PREFIX = "tf:calendar-events:";
const STALE_MS = 6 * 60 * 60 * 1000; // 6 hours

function cacheKey(monthKey: string): string {
  return `${PREFIX}${monthKey}`;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Read cached events for a month. Returns null if missing or stale. */
export function getCachedMonth(monthKey: string): MarketEvent[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(monthKey));
    if (!raw) return null;
    const cached: CachedMonth = JSON.parse(raw);

    // Past months never go stale; current month stales after STALE_MS
    if (monthKey === currentMonthKey()) {
      if (Date.now() - cached.fetchedAt > STALE_MS) return null;
    }

    return cached.events;
  } catch {
    return null;
  }
}

/** Write events for a month into cache. */
export function setCachedMonth(monthKey: string, events: MarketEvent[]): void {
  try {
    const entry: CachedMonth = { fetchedAt: Date.now(), events };
    localStorage.setItem(cacheKey(monthKey), JSON.stringify(entry));
  } catch {
    // localStorage full — silently skip
  }
}

/** Check if a month is already cached (and not stale). */
export function isCached(monthKey: string): boolean {
  return getCachedMonth(monthKey) !== null;
}

/**
 * Fetch events for a month, cache-first.
 * Returns events from cache if available, otherwise fetches from API and caches.
 */
export async function fetchMonthEvents(monthKey: string): Promise<MarketEvent[]> {
  const cached = getCachedMonth(monthKey);
  if (cached) return cached;

  try {
    const res = await fetch(`/api/calendar/market-events?month=${monthKey}`);
    if (!res.ok) return [];
    const data = await res.json();
    const events: MarketEvent[] = data.events ?? [];
    setCachedMonth(monthKey, events);
    return events;
  } catch {
    return [];
  }
}

/** Generate month keys: current + next N months. */
export function getMonthKeys(year: number, month: number, ahead: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i <= ahead; i++) {
    let m = month + i;
    let y = year;
    while (m > 11) { m -= 12; y++; }
    keys.push(`${y}-${String(m + 1).padStart(2, "0")}`);
  }
  return keys;
}

/**
 * Preload current + next `ahead` months into cache.
 * Non-blocking — fires fetches without awaiting all.
 */
export function preloadMonths(year: number, month: number, ahead = 3): void {
  const keys = getMonthKeys(year, month, ahead);
  for (const key of keys) {
    if (!isCached(key)) {
      fetchMonthEvents(key); // fire-and-forget
    }
  }
}
