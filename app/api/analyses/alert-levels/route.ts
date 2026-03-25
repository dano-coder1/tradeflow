import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChartAnalysis } from "@/types/ai";

export interface AlertLevel {
  symbol: string;
  analysisId: string;
  levels: number[];
}

type AnalysisJson = ChartAnalysis & { _symbol?: string };

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
    a.telegram_block, a.decision_zone, a.long_scenario, a.short_scenario,
    a.sniper_entry, a.no_trade_condition, a.reasoning ?? "",
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

function extractNumeric(s: string | undefined | null): number | null {
  if (!s || s === "N/A") return null;
  const matches = s.match(/\d[\d,]*\.?\d*/g);
  if (!matches) return null;
  let best: number | null = null;
  for (const m of matches) {
    const n = parseFloat(m.replace(/,/g, ""));
    if (!isFinite(n) || n < 100) continue;
    if (best === null || n > best) best = n;
  }
  return best;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all analyses — symbol is inside output_json, not a separate column
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("id, output_json")
    .eq("user_id", user.id)
    .limit(200);

  if (error) {
    console.error("[alert-levels] query error:", error.message);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  const result: AlertLevel[] = [];
  for (const row of data ?? []) {
    const json = row.output_json as AnalysisJson;
    const sym = json?._symbol ?? detectSymbolFromJson(json);
    if (!sym) continue;

    const levels: number[] = [];
    for (const field of [json.sl, json.tp1, json.tp2, json.tp3]) {
      const n = extractNumeric(field);
      if (n != null) levels.push(n);
    }
    const entryLevel = extractNumeric(json.sniper_entry);
    if (entryLevel != null) levels.push(entryLevel);

    if (levels.length > 0) {
      result.push({ symbol: sym, analysisId: row.id, levels: [...new Set(levels)] });
    }
  }

  return NextResponse.json(result);
}
