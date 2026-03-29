import { NextRequest, NextResponse } from "next/server";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MarketEvent {
  id: string;
  title: string;
  time: string; // ISO 8601
  impact: "low" | "medium" | "high";
  currency: string;
}

// ── Event templates ─────────────────────────────────────────────────────────
// Realistic economic calendar events rotated across trading days.

interface EventTemplate {
  title: string;
  hour: number;
  minute: number;
  impact: "low" | "medium" | "high";
  currency: string;
}

const TEMPLATES: EventTemplate[][] = [
  // Pattern 0 — heavy US day
  [
    { title: "USD Core Retail Sales m/m", hour: 13, minute: 30, impact: "high", currency: "USD" },
    { title: "USD Unemployment Claims", hour: 13, minute: 30, impact: "medium", currency: "USD" },
    { title: "EUR German Manufacturing PMI", hour: 8, minute: 30, impact: "medium", currency: "EUR" },
    { title: "USD FOMC Member Speaks", hour: 17, minute: 0, impact: "medium", currency: "USD" },
  ],
  // Pattern 1 — GBP + EUR focus
  [
    { title: "GBP UK CPI y/y", hour: 9, minute: 0, impact: "high", currency: "GBP" },
    { title: "EUR ECB President Lagarde Speaks", hour: 10, minute: 0, impact: "medium", currency: "EUR" },
    { title: "USD Crude Oil Inventories", hour: 15, minute: 30, impact: "low", currency: "USD" },
  ],
  // Pattern 2 — JPY + NZD
  [
    { title: "JPY BOJ Interest Rate Decision", hour: 3, minute: 0, impact: "high", currency: "JPY" },
    { title: "NZD GDP q/q", hour: 21, minute: 45, impact: "high", currency: "NZD" },
    { title: "USD ISM Manufacturing PMI", hour: 15, minute: 0, impact: "medium", currency: "USD" },
  ],
  // Pattern 3 — NFP-style
  [
    { title: "USD Non-Farm Payrolls", hour: 13, minute: 30, impact: "high", currency: "USD" },
    { title: "USD Average Hourly Earnings m/m", hour: 13, minute: 30, impact: "medium", currency: "USD" },
    { title: "CAD Employment Change", hour: 13, minute: 30, impact: "high", currency: "CAD" },
  ],
  // Pattern 4 — AUD + CHF
  [
    { title: "AUD RBA Interest Rate Decision", hour: 4, minute: 30, impact: "high", currency: "AUD" },
    { title: "CHF SNB Policy Rate", hour: 8, minute: 30, impact: "high", currency: "CHF" },
    { title: "EUR Consumer Confidence", hour: 15, minute: 0, impact: "low", currency: "EUR" },
  ],
  // Pattern 5 — light day
  [
    { title: "EUR German ZEW Economic Sentiment", hour: 10, minute: 0, impact: "medium", currency: "EUR" },
    { title: "USD Building Permits", hour: 13, minute: 30, impact: "low", currency: "USD" },
  ],
  // Pattern 6 — CPI day
  [
    { title: "USD CPI m/m", hour: 13, minute: 30, impact: "high", currency: "USD" },
    { title: "USD Core CPI m/m", hour: 13, minute: 30, impact: "high", currency: "USD" },
    { title: "GBP GDP m/m", hour: 7, minute: 0, impact: "high", currency: "GBP" },
    { title: "EUR Industrial Production m/m", hour: 10, minute: 0, impact: "low", currency: "EUR" },
  ],
];

// ── Generator ───────────────────────────────────────────────────────────────

function isWeekday(date: Date): boolean {
  const dow = date.getUTCDay();
  return dow >= 1 && dow <= 5;
}

/** Simple deterministic hash for a date to pick a template pattern. */
function dateSeed(y: number, m: number, d: number): number {
  return ((y * 367 + m * 31 + d) * 2654435761) >>> 0;
}

function generateMonthEvents(year: number, month: number): MarketEvent[] {
  const events: MarketEvent[] = [];
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  let eventId = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, month, d));
    if (!isWeekday(dt)) continue;

    const seed = dateSeed(year, month, d);
    const pattern = TEMPLATES[seed % TEMPLATES.length];

    // ~30% of weekdays have no events (market holidays, light days)
    if (seed % 10 < 3 && pattern !== TEMPLATES[6]) continue;

    for (const tpl of pattern) {
      events.push({
        id: `evt-${year}${String(month).padStart(2, "0")}${String(d).padStart(2, "0")}-${eventId++}`,
        title: tpl.title,
        time: new Date(Date.UTC(year, month, d, tpl.hour, tpl.minute)).toISOString(),
        impact: tpl.impact,
        currency: tpl.currency,
      });
    }
  }

  return events;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const monthParam = searchParams.get("month"); // "YYYY-MM"

  let year: number;
  let month: number;

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m - 1; // JS months are 0-indexed
  } else {
    const now = new Date();
    year = now.getUTCFullYear();
    month = now.getUTCMonth();
  }

  const events = generateMonthEvents(year, month);
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  return NextResponse.json(
    { month: monthKey, events },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    }
  );
}
