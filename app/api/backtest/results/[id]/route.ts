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

    // Single query: fetch the job with its results via join
    // This ensures ownership check and result fetch happen atomically
    const { data: job, error: jobErr } = await supabase
      .from("backtest_jobs")
      .select("id, backtest_results(job_id, metrics, equity_curve, trades, summary)")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // backtest_results is a one-to-one relation (unique on job_id),
    // but supabase-js returns it as an array — take the first element
    const results = Array.isArray(job.backtest_results)
      ? job.backtest_results[0]
      : job.backtest_results;

    if (!results) {
      return NextResponse.json({ error: "Results not ready" }, { status: 404 });
    }

    return NextResponse.json({
      job_id: results.job_id,
      metrics: results.metrics,
      equity_curve: results.equity_curve,
      trades: results.trades,
      summary: results.summary,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
