import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChartAnalysis } from "@/types/ai";

export interface AnalysisRun {
  id: string;
  bias: ChartAnalysis["bias"];
  no_trade: boolean;
  telegram_block: string;
  image_count: number;
  output_json: ChartAnalysis;
  created_at: string;
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("analysis_runs")
      .select("id, bias, no_trade, telegram_block, image_urls, output_json, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[analyze-chart/history] query error:", error.message);
      return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }

    const runs: AnalysisRun[] = (data ?? []).map((row) => ({
      id: row.id,
      bias: row.bias,
      no_trade: row.no_trade,
      telegram_block: row.telegram_block,
      image_count: Array.isArray(row.image_urls) ? row.image_urls.length : 0,
      output_json: row.output_json as ChartAnalysis,
      created_at: row.created_at,
    }));

    return NextResponse.json(runs);
  } catch (e) {
    console.error("[analyze-chart/history] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
