import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: jobId } = await params;

    // Step 1: verify job belongs to user
    const { data: job, error: jobErr } = await supabase
      .from("backtest_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobErr || !job) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Step 2: fetch results by job_id
    const { data, error } = await supabase
      .from("backtest_results")
      .select("job_id, metrics, equity_curve, trades, summary")
      .eq("job_id", jobId)
      .maybeSingle();

    if (error || !data) return NextResponse.json({ error: "Results not found" }, { status: 404 });

    // Handle legacy equity_curve format (number[] instead of {ts, equity}[])
    let equityCurve = data.equity_curve;
    if (Array.isArray(equityCurve) && equityCurve.length > 0 && typeof equityCurve[0] === "number") {
      console.warn("OLD EQUITY FORMAT DETECTED for job", jobId);
      equityCurve = (equityCurve as number[]).map((val: number, i: number) => ({
        ts: new Date(2024, 0, 1, 0, i * 15).toISOString(),
        equity: val,
      }));
    }

    return NextResponse.json({
      job_id: data.job_id,
      metrics: data.metrics,
      equity_curve: equityCurve,
      trades: data.trades,
      summary: data.summary,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
