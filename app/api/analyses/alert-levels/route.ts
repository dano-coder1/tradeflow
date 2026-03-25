import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChartAnalysis } from "@/types/ai";

export interface AlertLevel {
  symbol: string;
  analysisId: string;
  levels: number[];
}

function extractNumeric(s: string | undefined | null): number | null {
  if (!s || s === "N/A") return null;
  const m = s.match(/\d[\d,]*\.?\d*/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(/,/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only fetch analyses from the last 30 days that have a symbol tagged
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("id, symbol, output_json")
    .eq("user_id", user.id)
    .not("symbol", "is", null)
    .gte("created_at", since)
    .limit(100);

  if (error) {
    console.error("[alert-levels] query error:", error.message);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  const result: AlertLevel[] = [];
  for (const row of data ?? []) {
    const analysis = row.output_json as ChartAnalysis;
    const levels: number[] = [];

    for (const field of [analysis.sl, analysis.tp1, analysis.tp2, analysis.tp3]) {
      const n = extractNumeric(field);
      if (n != null) levels.push(n);
    }

    // Also try to extract a price from sniper_entry
    const entryLevel = extractNumeric(analysis.sniper_entry);
    if (entryLevel != null) levels.push(entryLevel);

    if (levels.length > 0) {
      result.push({ symbol: row.symbol, analysisId: row.id, levels: [...new Set(levels)] });
    }
  }

  return NextResponse.json(result);
}
