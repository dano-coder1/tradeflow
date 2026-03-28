import { NextResponse } from "next/server";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MarketEvent {
  id: string;
  title: string;
  time: string; // ISO 8601
  impact: "low" | "medium" | "high";
  currency: string;
}

// ── Mock data generator ──────────────────────────────────────────────────────
// Generates realistic-looking events for today. Replace with a real API
// (e.g. Forex Factory, Investing.com, MQL5 calendar) when available.

function generateTodayEvents(): MarketEvent[] {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  const events: Omit<MarketEvent, "id">[] = [
    { title: "JPY BOJ Interest Rate Decision", time: new Date(Date.UTC(y, m, d, 3, 0)).toISOString(), impact: "high", currency: "JPY" },
    { title: "EUR German Manufacturing PMI", time: new Date(Date.UTC(y, m, d, 8, 30)).toISOString(), impact: "medium", currency: "EUR" },
    { title: "GBP UK CPI y/y", time: new Date(Date.UTC(y, m, d, 9, 0)).toISOString(), impact: "high", currency: "GBP" },
    { title: "EUR ECB President Lagarde Speaks", time: new Date(Date.UTC(y, m, d, 10, 0)).toISOString(), impact: "medium", currency: "EUR" },
    { title: "USD Core Retail Sales m/m", time: new Date(Date.UTC(y, m, d, 13, 30)).toISOString(), impact: "high", currency: "USD" },
    { title: "USD Unemployment Claims", time: new Date(Date.UTC(y, m, d, 13, 30)).toISOString(), impact: "medium", currency: "USD" },
    { title: "USD Crude Oil Inventories", time: new Date(Date.UTC(y, m, d, 15, 30)).toISOString(), impact: "low", currency: "USD" },
    { title: "USD FOMC Member Speaks", time: new Date(Date.UTC(y, m, d, 17, 0)).toISOString(), impact: "medium", currency: "USD" },
    { title: "NZD GDP q/q", time: new Date(Date.UTC(y, m, d, 21, 45)).toISOString(), impact: "high", currency: "NZD" },
  ];

  return events.map((e, i) => ({ ...e, id: `evt-${i}` }));
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const events = generateTodayEvents();
  return NextResponse.json({ events });
}
