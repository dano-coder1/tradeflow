import { NextRequest, NextResponse } from "next/server";

// Map canonical symbol → Yahoo Finance ticker
const YAHOO_MAP: Record<string, string> = {
  XAUUSD: "GC=F",
  GOLD: "GC=F",
  XAGUSD: "SI=F",
  SILVER: "SI=F",
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "USDJPY=X",
  AUDUSD: "AUDUSD=X",
  USDCHF: "USDCHF=X",
  USDCAD: "USDCAD=X",
  NZDUSD: "NZDUSD=X",
  EURGBP: "EURGBP=X",
  EURJPY: "EURJPY=X",
  GBPJPY: "GBPJPY=X",
  CHFJPY: "CHFJPY=X",
  AUDJPY: "AUDJPY=X",
  NAS100: "NQ=F",
  US30: "YM=F",
  US500: "ES=F",
  SPX500: "ES=F",
  DXY: "DX-Y.NYB",
  USOIL: "CL=F",
  UKOIL: "BZ=F",
};

// Map canonical symbol → Binance symbol
const BINANCE_MAP: Record<string, string> = {
  BTC: "BTCUSDT",
  BTCUSD: "BTCUSDT",
  BTCUSDT: "BTCUSDT",
  ETH: "ETHUSDT",
  ETHUSD: "ETHUSDT",
  ETHUSDT: "ETHUSDT",
  BNB: "BNBUSDT",
  BNBUSDT: "BNBUSDT",
  SOL: "SOLUSDT",
  SOLUSDT: "SOLUSDT",
  XRP: "XRPUSDT",
  XRPUSDT: "XRPUSDT",
  DOGE: "DOGEUSDT",
  ADA: "ADAUSDT",
};

async function fetchBinance(binanceSymbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const price = parseFloat(json.price);
    return isFinite(price) ? price : null;
  } catch {
    return null;
  }
}

async function fetchYahoo(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" ? price : null;
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  // Try Binance (crypto)
  const binanceSym = BINANCE_MAP[upper];
  if (binanceSym) {
    const price = await fetchBinance(binanceSym);
    if (price != null) return NextResponse.json({ symbol: upper, price });
  }

  // Try Yahoo Finance (forex / metals / indices)
  const yahooTicker = YAHOO_MAP[upper];
  if (yahooTicker) {
    const price = await fetchYahoo(yahooTicker);
    if (price != null) return NextResponse.json({ symbol: upper, price });
  }

  return NextResponse.json({ error: "Price unavailable for " + upper }, { status: 404 });
}
