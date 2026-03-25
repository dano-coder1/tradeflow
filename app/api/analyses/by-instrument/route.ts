import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChartAnalysis } from "@/types/ai";

export interface AnalysisEntry {
  id: string;
  bias: ChartAnalysis["bias"];
  no_trade: boolean;
  confidence: number;
  image_count: number;
  created_at: string;
  telegram_block: string;
  continued_from: string | null;
  output_json: ChartAnalysis;
}

export interface AnalysisByInstrument {
  symbol: string;
  count: number;
  analyses: AnalysisEntry[];
}

type AnalysisJson = ChartAnalysis & { _symbol?: string; _continued_from?: string };

// ─── Server-side symbol detection (mirrors client-side logic) ────────────────

const KNOWN_INSTRUMENTS = [
  "XAUUSD", "XAGUSD",
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCHF", "USDCAD", "NZDUSD",
  "EURGBP", "EURJPY", "GBPJPY", "CHFJPY", "AUDJPY",
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
  "BTCUSD", "ETHUSD",
  "NAS100", "US500", "SPX500", "US30", "DXY", "USOIL", "UKOIL",
  "BTC", "ETH", "BNB", "SOL", "XRP",
];

const ALIASES: Array<[RegExp, string]> = [
  [/\bGOLD\b/i,        "XAUUSD"],
  [/\bSILVER\b/i,      "XAGUSD"],
  [/\bBITCOIN\b/i,     "BTCUSDT"],
  [/\bETHEREUM\b/i,    "ETHUSDT"],
  [/\bNASDAQ\b/i,      "NAS100"],
  [/\bDOW\s*JONES\b/i, "US30"],
  [/\bS&P\b/i,         "US500"],
  [/\bCRUDE\s*OIL\b/i, "USOIL"],
];

function detectSymbolFromJson(a: ChartAnalysis): string | null {
  const parts: string[] = [
    a.telegram_block,
    a.decision_zone,
    a.long_scenario,
    a.short_scenario,
    a.sniper_entry,
    a.no_trade_condition,
    a.reasoning ?? "",
    a.reason_if_no_trade ?? "",
    ...Object.values(a.smc_notes ?? {}).filter((v): v is string => !!v),
  ];
  const fullText = parts.join(" ");

  for (const [pattern, canonical] of ALIASES) {
    if (pattern.test(fullText)) return canonical;
  }

  const normalized = fullText.replace(/\//g, "").toUpperCase();
  for (const sym of KNOWN_INSTRUMENTS) {
    if (normalized.includes(sym)) return sym;
  }
  return null;
}

// ─── Route ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("[by-instrument] auth failed:", userError?.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[by-instrument] fetching for user:", user.id);

  // No filter on a separate symbol column — symbol is stored as _symbol inside output_json.
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("id, bias, no_trade, telegram_block, image_urls, output_json, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[by-instrument] query error:", error.message);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  console.log("[by-instrument] total rows fetched:", data?.length ?? 0);

  // Group by _symbol from output_json; fall back to auto-detection for untagged analyses
  const grouped = new Map<string, AnalysisByInstrument>();
  for (const row of data ?? []) {
    const json = row.output_json as AnalysisJson;
    const sym = json?._symbol ?? detectSymbolFromJson(json);
    if (!sym) continue;

    if (!grouped.has(sym)) {
      grouped.set(sym, { symbol: sym, count: 0, analyses: [] });
    }
    const entry = grouped.get(sym)!;
    entry.count += 1;
    entry.analyses.push({
      id: row.id,
      bias: row.bias,
      no_trade: row.no_trade,
      confidence: json?.confidence ?? 0,
      image_count: Array.isArray(row.image_urls) ? row.image_urls.length : 0,
      created_at: row.created_at,
      telegram_block: row.telegram_block,
      continued_from: json?._continued_from ?? null,
      output_json: json,
    });
  }

  const result = Array.from(grouped.values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
  );

  console.log("[by-instrument] returning", result.length, "instrument groups:", result.map((g) => g.symbol));
  return NextResponse.json(result);
}
