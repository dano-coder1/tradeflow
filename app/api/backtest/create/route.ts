import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function generateStrategyName(dsl: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push((dsl.market as string) ?? "UNKNOWN");
  parts.push((dsl.timeframe as string) ?? "");

  const entry = dsl.entry as Record<string, unknown> | undefined;
  if (entry?.conditions && Array.isArray(entry.conditions)) {
    for (const c of entry.conditions) {
      if (c.type === "ema_cross") parts.push(`EMA${c.fast}/${c.slow}`);
      if (c.type === "rsi_above") parts.push(`RSI>${c.value}`);
      if (c.type === "rsi_below") parts.push(`RSI<${c.value}`);
    }
  }

  return parts.filter(Boolean).join(" ");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { dsl, config, saveOnly } = body as {
      dsl: Record<string, unknown>;
      config?: Record<string, unknown>;
      saveOnly?: boolean;
    };

    if (!dsl) return NextResponse.json({ error: "dsl is required" }, { status: 400 });

    const { data: strategy, error: stratErr } = await supabase
      .from("strategies")
      .insert({
        user_id: user.id,
        name: generateStrategyName(dsl),
        dsl,
      })
      .select("id")
      .single();

    if (stratErr) return NextResponse.json({ error: stratErr.message }, { status: 400 });

    if (saveOnly) {
      return NextResponse.json({ strategy_id: strategy.id, saved: true });
    }

    const { data: job, error: jobErr } = await supabase
      .from("backtest_jobs")
      .insert({
        user_id: user.id,
        strategy_id: strategy.id,
        status: "pending",
        config: config ?? null,
      })
      .select("id, status")
      .single();

    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 400 });

    return NextResponse.json({
      job_id: job.id,
      strategy_id: strategy.id,
      status: job.status,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
