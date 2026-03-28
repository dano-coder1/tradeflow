import { NextRequest, NextResponse } from "next/server";

// ── Symbol mapping ───────────────────────────────────────────────────────────

const SYMBOL_MAP: Record<string, string> = {
  XAUUSD: "XAU/USD",
  XAGUSD: "XAG/USD",
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  GBPJPY: "GBP/JPY",
  NAS100: "IXIC",
  US30: "DJI",
  OIL: "CL",
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
    return NextResponse.json({ error: "Missing parameter: symbol" }, { status: 400 });
  }

  const tdSymbol = SYMBOL_MAP[symbol.toUpperCase()] ?? symbol;
  const interval = INTERVAL_MAP[timeframe] ?? "1h";
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    console.error("[candles] TWELVE_DATA_API_KEY is not set in environment variables");
    return NextResponse.json(
      { error: "API key not configured. Add TWELVE_DATA_API_KEY to your .env.local file." },
      { status: 503 },
    );
  }

  const tdUrl = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${interval}&outputsize=200&apikey=${apiKey}`;

  try {
    console.log(`[candles] Fetching ${tdSymbol} ${interval} from Twelve Data`);
    const res = await fetch(tdUrl, { signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[candles] Twelve Data HTTP ${res.status}: ${text.slice(0, 200)}`);
      return NextResponse.json(
        { error: `Provider returned HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();

    // Twelve Data returns { status: "error", message: "..." } on failures
    if (data.status === "error") {
      console.error(`[candles] Twelve Data error for ${tdSymbol}: ${data.message}`);
      return NextResponse.json(
        { error: `Provider error: ${data.message ?? "Unknown error"}` },
        { status: 502 },
      );
    }

    if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
      console.error(`[candles] No candle data returned for ${tdSymbol} ${interval}`);
      return NextResponse.json(
        { error: `No data available for ${symbol} on ${timeframe} timeframe` },
        { status: 404 },
      );
    }

    // Normalize: Twelve Data returns newest first, we need oldest first
    const candles = data.values
      .map((v: { datetime: string; open: string; high: string; low: string; close: string }) => {
        const time = Math.floor(new Date(v.datetime).getTime() / 1000);
        return {
          time,
          open: parseFloat(v.open),
          high: parseFloat(v.high),
          low: parseFloat(v.low),
          close: parseFloat(v.close),
        };
      })
      .filter((c: { time: number; open: number }) => !isNaN(c.time) && !isNaN(c.open))
      .reverse();

    if (candles.length === 0) {
      return NextResponse.json(
        { error: `Received data but all candles were invalid for ${symbol}` },
        { status: 502 },
      );
    }

    console.log(`[candles] Returning ${candles.length} candles for ${tdSymbol} ${interval}`);
    return NextResponse.json({ candles, symbol: tdSymbol, interval, count: candles.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(`[candles] Fetch failed for ${tdSymbol} ${interval}:`, msg);

    if (msg.includes("abort") || msg.includes("timeout")) {
      return NextResponse.json({ error: "Provider request timed out. Try again." }, { status: 504 });
    }

    return NextResponse.json({ error: `Failed to fetch data: ${msg}` }, { status: 500 });
  }
}
