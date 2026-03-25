import { NextRequest, NextResponse } from "next/server";

// ── Binance (crypto) ────────────────────────────────────────────────────────
const BINANCE_MAP: Record<string, string> = {
  BTC: "BTCUSDT", BTCUSD: "BTCUSDT", BTCUSDT: "BTCUSDT",
  ETH: "ETHUSDT", ETHUSD: "ETHUSDT", ETHUSDT: "ETHUSDT",
  BNB: "BNBUSDT", BNBUSDT: "BNBUSDT",
  SOL: "SOLUSDT", SOLUSDT: "SOLUSDT",
  XRP: "XRPUSDT", XRPUSDT: "XRPUSDT",
  DOGE: "DOGEUSDT", ADA: "ADAUSDT",
};

async function fetchBinance(binanceSymbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`,
      { cache: "no-store" }
    );
    if (!res.ok) { console.warn("[prices] binance failed:", res.status); return null; }
    const json = await res.json();
    const price = parseFloat(json.price);
    return isFinite(price) ? price : null;
  } catch (e) { console.warn("[prices] binance error:", e); return null; }
}

// ── Metals.live (gold, silver — free, no auth) ─────────────────────────────
const METALS_MAP: Record<string, string> = {
  XAUUSD: "gold", GOLD: "gold",
  XAGUSD: "silver", SILVER: "silver",
};

async function fetchMetals(metal: string): Promise<number | null> {
  try {
    const res = await fetch("https://api.metals.live/v1/spot", { cache: "no-store" });
    if (!res.ok) { console.warn("[prices] metals.live failed:", res.status); return null; }
    const json = await res.json();
    if (!Array.isArray(json)) return null;
    const entry = json.find((e: { metal: string }) => e.metal === metal);
    const price = entry ? parseFloat(entry.price) : null;
    return price && isFinite(price) ? price : null;
  } catch (e) { console.warn("[prices] metals.live error:", e); return null; }
}

// ── Frankfurter (forex — free, no auth) ─────────────────────────────────────
// Frankfurter gives rates relative to a base. E.g. EUR/USD = 1/rate(USD→EUR).
const FRANKFURTER_MAP: Record<string, { base: string; quote: string }> = {
  EURUSD: { base: "EUR", quote: "USD" },
  GBPUSD: { base: "GBP", quote: "USD" },
  AUDUSD: { base: "AUD", quote: "USD" },
  NZDUSD: { base: "NZD", quote: "USD" },
  USDJPY: { base: "USD", quote: "JPY" },
  USDCHF: { base: "USD", quote: "CHF" },
  USDCAD: { base: "USD", quote: "CAD" },
  EURGBP: { base: "EUR", quote: "GBP" },
  EURJPY: { base: "EUR", quote: "JPY" },
  GBPJPY: { base: "GBP", quote: "JPY" },
  CHFJPY: { base: "CHF", quote: "JPY" },
  AUDJPY: { base: "AUD", quote: "JPY" },
};

async function fetchFrankfurter(base: string, quote: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quote}`,
      { cache: "no-store" }
    );
    if (!res.ok) { console.warn("[prices] frankfurter failed:", res.status); return null; }
    const json = await res.json();
    const rate = json?.rates?.[quote];
    return typeof rate === "number" ? rate : null;
  } catch (e) { console.warn("[prices] frankfurter error:", e); return null; }
}

// ── Yahoo Finance (indices + fallback) ──────────────────────────────────────
const YAHOO_MAP: Record<string, string> = {
  NAS100: "NQ=F", US30: "YM=F", US500: "ES=F", SPX500: "ES=F",
  DXY: "DX-Y.NYB", USOIL: "CL=F", UKOIL: "BZ=F",
};

async function fetchYahoo(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    if (!res.ok) { console.warn("[prices] yahoo failed:", res.status, "for", ticker); return null; }
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" ? price : null;
  } catch (e) { console.warn("[prices] yahoo error:", e); return null; }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  console.log("[prices] fetching:", upper);

  // 1. Binance (crypto)
  const binanceSym = BINANCE_MAP[upper];
  if (binanceSym) {
    const price = await fetchBinance(binanceSym);
    if (price != null) {
      console.log("[prices]", upper, "=", price, "(binance)");
      return NextResponse.json({ symbol: upper, price });
    }
  }

  // 2. Metals.live (gold, silver)
  const metal = METALS_MAP[upper];
  if (metal) {
    const price = await fetchMetals(metal);
    if (price != null) {
      console.log("[prices]", upper, "=", price, "(metals.live)");
      return NextResponse.json({ symbol: upper, price });
    }
  }

  // 3. Frankfurter (forex)
  const fx = FRANKFURTER_MAP[upper];
  if (fx) {
    const price = await fetchFrankfurter(fx.base, fx.quote);
    if (price != null) {
      console.log("[prices]", upper, "=", price, "(frankfurter)");
      return NextResponse.json({ symbol: upper, price });
    }
  }

  // 4. Yahoo Finance (indices, fallback)
  const yahooTicker = YAHOO_MAP[upper];
  if (yahooTicker) {
    const price = await fetchYahoo(yahooTicker);
    if (price != null) {
      console.log("[prices]", upper, "=", price, "(yahoo)");
      return NextResponse.json({ symbol: upper, price });
    }
  }

  console.warn("[prices] no price source for:", upper);
  return NextResponse.json({ error: "Price unavailable for " + upper }, { status: 404 });
}
