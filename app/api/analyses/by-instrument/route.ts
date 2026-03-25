import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChartAnalysis } from "@/types/ai";

export interface AnalysisByInstrument {
  symbol: string;
  count: number;
  analyses: {
    id: string;
    bias: ChartAnalysis["bias"];
    no_trade: boolean;
    confidence: number;
    image_count: number;
    created_at: string;
    telegram_block: string;
  }[];
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("analysis_runs")
    .select("id, bias, no_trade, telegram_block, image_urls, output_json, created_at, symbol")
    .eq("user_id", user.id)
    .not("symbol", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[by-instrument] query error:", error.message);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  // Group by symbol
  const grouped = new Map<string, AnalysisByInstrument>();
  for (const row of data ?? []) {
    const sym: string = row.symbol;
    if (!grouped.has(sym)) {
      grouped.set(sym, { symbol: sym, count: 0, analyses: [] });
    }
    const entry = grouped.get(sym)!;
    entry.count += 1;
    entry.analyses.push({
      id: row.id,
      bias: row.bias,
      no_trade: row.no_trade,
      confidence: (row.output_json as ChartAnalysis)?.confidence ?? 0,
      image_count: Array.isArray(row.image_urls) ? row.image_urls.length : 0,
      created_at: row.created_at,
      telegram_block: row.telegram_block,
    });
  }

  // Sort symbols alphabetically, analyses within each already desc by created_at
  const result = Array.from(grouped.values()).sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
  );

  return NextResponse.json(result);
}
