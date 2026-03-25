import { NextRequest, NextResponse } from "next/server";

const TIMEOUT_MS = 3_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

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
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`;
  try {
    console.log("[prices] trying binance:", url);
    const res = await fetchWithTimeout(url);
    if (!res.ok) { console.warn("[prices] binance HTTP", res.status); return null; }
    const json = await res.json();
    const price = parseFloat(json.price);
    if (!isFinite(price)) { console.warn("[prices] binance bad price:", json); return null; }
    console.log("[prices] binance OK:", binanceSymbol, "=", price);
    return price;
  } catch (e) { console.warn("[prices] binance error:", (e as Error).message); return null; }
}

// ── Gold / Silver ───────────────────────────────────────────────────────────
const GOLD_SYMBOLS = new Set(["XAUUSD", "GOLD", "XAU"]);
const SILVER_SYMBOLS = new Set(["XAGUSD", "SILVER", "XAG"]);

async function fetchGoldPrice(): Promise<number | null> {
  // Source 1: metals.live
  try {
    const url = "https://api.metals.live/v1/spot/gold";
    console.log("[prices] trying metals.live gold:", url);
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const json = await res.json();
      // Returns array: [{ price: "3025.50", ... }] or { price: ... }
      let price: number | null = null;
      if (Array.isArray(json) && json.length > 0) {
        price = parseFloat(json[0].price);
      } else if (json && json.price) {
        price = parseFloat(json.price);
      }
      if (price && isFinite(price)) {
        console.log("[prices] metals.live gold OK:", price);
        return price;
      }
      console.warn("[prices] metals.live gold bad response:", JSON.stringify(json).slice(0, 200));
    } else {
      console.warn("[prices] metals.live gold HTTP", res.status);
    }
  } catch (e) { console.warn("[prices] metals.live gold error:", (e as Error).message); }

  // Source 2: Swissquote
  try {
    const url = "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD";
    console.log("[prices] trying swissquote gold:", url);
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const json = await res.json();
      // Returns array of quotes, each with spreadProfilePrices
      if (Array.isArray(json) && json.length > 0) {
        const prices = json[0]?.spreadProfilePrices;
        if (Array.isArray(prices) && prices.length > 0) {
          const bid = prices[0].bid;
          const ask = prices[0].ask;
          const mid = (bid + ask) / 2;
          if (isFinite(mid)) {
            console.log("[prices] swissquote gold OK:", mid);
            return mid;
          }
        }
      }
      console.warn("[prices] swissquote gold bad response:", JSON.stringify(json).slice(0, 200));
    } else {
      console.warn("[prices] swissquote gold HTTP", res.status);
    }
  } catch (e) { console.warn("[prices] swissquote gold error:", (e as Error).message); }

  // Source 3: Yahoo Finance
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d";
    console.log("[prices] trying yahoo gold:", url);
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) {
      const json = await res.json();
      const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof price === "number" && isFinite(price)) {
        console.log("[prices] yahoo gold OK:", price);
        return price;
      }
      console.warn("[prices] yahoo gold bad response:", JSON.stringify(json).slice(0, 200));
    } else {
      console.warn("[prices] yahoo gold HTTP", res.status);
    }
  } catch (e) { console.warn("[prices] yahoo gold error:", (e as Error).message); }

  return null;
}

async function fetchSilverPrice(): Promise<number | null> {
  try {
    const url = "https://api.metals.live/v1/spot/silver";
    console.log("[prices] trying metals.live silver:", url);
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const json = await res.json();
      let price: number | null = null;
      if (Array.isArray(json) && json.length > 0) price = parseFloat(json[0].price);
      else if (json && json.price) price = parseFloat(json.price);
      if (price && isFinite(price)) { console.log("[prices] metals.live silver OK:", price); return price; }
    }
  } catch (e) { console.warn("[prices] metals.live silver error:", (e as Error).message); }

  try {
    const url = "https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAG/USD";
    console.log("[prices] trying swissquote silver:", url);
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        const prices = json[0]?.spreadProfilePrices;
        if (Array.isArray(prices) && prices.length > 0) {
          const mid = (prices[0].bid + prices[0].ask) / 2;
          if (isFinite(mid)) { console.log("[prices] swissquote silver OK:", mid); return mid; }
        }
      }
    }
  } catch (e) { console.warn("[prices] swissquote silver error:", (e as Error).message); }

  return null;
}

// ── Forex ────────────────────────────────────────────────────────────────────
// Maps symbol → { base, quote } for rate calculation
const FOREX_MAP: Record<string, { base: string; quote: string }> = {
  EURUSD: { base: "eur", quote: "usd" },
  GBPUSD: { base: "gbp", quote: "usd" },
  AUDUSD: { base: "aud", quote: "usd" },
  NZDUSD: { base: "nzd", quote: "usd" },
  USDJPY: { base: "usd", quote: "jpy" },
  USDCHF: { base: "usd", quote: "chf" },
  USDCAD: { base: "usd", quote: "cad" },
  EURGBP: { base: "eur", quote: "gbp" },
  EURJPY: { base: "eur", quote: "jpy" },
  GBPJPY: { base: "gbp", quote: "jpy" },
  CHFJPY: { base: "chf", quote: "jpy" },
  AUDJPY: { base: "aud", quote: "jpy" },
};

async function fetchForex(base: string, quote: string): Promise<number | null> {
  // Source 1: fawazahmed0 currency API (jsdelivr CDN, very reliable)
  try {
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`;
    console.log("[prices] trying fawazahmed0:", url);
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const json = await res.json();
      const rate = json?.[base]?.[quote];
      if (typeof rate === "number" && isFinite(rate)) {
        console.log("[prices] fawazahmed0 OK:", `${base}/${quote}`, "=", rate);
        return rate;
      }
      console.warn("[prices] fawazahmed0 bad response for", base, quote);
    } else {
      console.warn("[prices] fawazahmed0 HTTP", res.status);
    }
  } catch (e) { console.warn("[prices] fawazahmed0 error:", (e as Error).message); }

  // Source 2: Swissquote
  try {
    const url = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${base.toUpperCase()}/${quote.toUpperCase()}`;
    console.log("[prices] trying swissquote forex:", url);
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        const prices = json[0]?.spreadProfilePrices;
        if (Array.isArray(prices) && prices.length > 0) {
          const mid = (prices[0].bid + prices[0].ask) / 2;
          if (isFinite(mid)) {
            console.log("[prices] swissquote forex OK:", mid);
            return mid;
          }
        }
      }
    }
  } catch (e) { console.warn("[prices] swissquote forex error:", (e as Error).message); }

  return null;
}

// ── Indices (Yahoo Finance fallback) ────────────────────────────────────────
const YAHOO_MAP: Record<string, string> = {
  NAS100: "NQ=F", US30: "YM=F", US500: "ES=F", SPX500: "ES=F",
  DXY: "DX-Y.NYB", USOIL: "CL=F", UKOIL: "BZ=F",
};

async function fetchYahoo(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
    console.log("[prices] trying yahoo:", url);
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) { console.warn("[prices] yahoo HTTP", res.status); return null; }
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price === "number") { console.log("[prices] yahoo OK:", ticker, "=", price); return price; }
    console.warn("[prices] yahoo bad response for", ticker);
    return null;
  } catch (e) { console.warn("[prices] yahoo error:", (e as Error).message); return null; }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();
  console.log("[prices] === request for:", upper, "===");

  // Crypto
  const binanceSym = BINANCE_MAP[upper];
  if (binanceSym) {
    const price = await fetchBinance(binanceSym);
    if (price != null) return NextResponse.json({ symbol: upper, price });
  }

  // Gold
  if (GOLD_SYMBOLS.has(upper)) {
    const price = await fetchGoldPrice();
    if (price != null) return NextResponse.json({ symbol: upper, price });
  }

  // Silver
  if (SILVER_SYMBOLS.has(upper)) {
    const price = await fetchSilverPrice();
    if (price != null) return NextResponse.json({ symbol: upper, price });
  }

  // Forex
  const fx = FOREX_MAP[upper];
  if (fx) {
    const price = await fetchForex(fx.base, fx.quote);
    if (price != null) return NextResponse.json({ symbol: upper, price });
  }

  // Indices
  const yahooTicker = YAHOO_MAP[upper];
  if (yahooTicker) {
    const price = await fetchYahoo(yahooTicker);
    if (price != null) return NextResponse.json({ symbol: upper, price });
  }

  console.warn("[prices] ALL sources failed for:", upper);
  return NextResponse.json({ error: "Price unavailable for " + upper }, { status: 404 });
}
