import { NextRequest, NextResponse } from "next/server";

// ── Symbol mapping ───────────────────────────────────────────────────────────
// Maps app symbols to Twelve Data symbols

const SYMBOL_MAP: Record<string, string> = {
  XAUUSD: "XAU/USD",
  XAGUSD: "XAG/USD",
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  GBPJPY: "GBP/JPY",
  NAS100: "NAS100",
  US30: "DJI",
  OIL: "WTI/USD",
  BTCUSD: "BTC/USD",
  ETHUSD: "ETH/USD",
  AUDUSD: "AUD/USD",
  USDCHF: "USD/CHF",
  NZDUSD: "NZD/USD",
  USDCAD: "USD/CAD",
  EURGBP: "EUR/GBP",
  EURJPY: "EUR/JPY",
};

// ── Timeframe mapping ────────────────────────────────────────────────────────
// Maps app timeframes to Twelve Data interval parameter

const INTERVAL_MAP: Record<string, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1h": "1h",
  "4h": "4h",
  "1D": "1day",
};

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const timeframe = searchParams.get("timeframe") ?? "1h";

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const tdSymbol = SYMBOL_MAP[symbol.toUpperCase()] ?? symbol;
  const interval = INTERVAL_MAP[timeframe] ?? "1h";
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "TWELVE_DATA_API_KEY not configured" }, { status: 500 });
  }

  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${interval}&outputsize=200&apikey=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      return NextResponse.json({ error: `Twelve Data returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();

    if (data.status === "error" || !data.values || !Array.isArray(data.values)) {
      return NextResponse.json({
        error: data.message ?? "No data returned from Twelve Data",
      }, { status: 502 });
    }

    // Normalize: Twelve Data returns newest first, we need oldest first
    const candles = data.values
      .map((v: { datetime: string; open: string; high: string; low: string; close: string }) => ({
        time: Math.floor(new Date(v.datetime).getTime() / 1000),
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
      }))
      .filter((c: { time: number; open: number }) => !isNaN(c.time) && !isNaN(c.open))
      .reverse(); // oldest first for lightweight-charts

    return NextResponse.json({
      candles,
      symbol: tdSymbol,
      interval,
      count: candles.length,
    });
  } catch (e) {
    console.error("[candles] error:", e);
    return NextResponse.json({ error: "Failed to fetch candle data" }, { status: 500 });
  }
}
