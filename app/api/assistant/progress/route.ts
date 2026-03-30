import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFocusStep, getTotalSteps } from "@/lib/assistant/focus-maps";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("assistant_profiles")
      .select("biggest_problem")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "No assistant profile" }, { status: 404 });
    }

    const problem = profile.biggest_problem || "default";

    // Load or create progress
    let { data: progress } = await supabase
      .from("assistant_progress")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!progress) {
      const { data: created } = await supabase
        .from("assistant_progress")
        .insert({ user_id: user.id, current_focus_index: 0 })
        .select("*")
        .single();
      progress = created;
    }

    // Load or create stats
    let { data: stats } = await supabase
      .from("assistant_stats")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!stats) {
      const { data: created } = await supabase
        .from("assistant_stats")
        .insert({ user_id: user.id })
        .select("*")
        .single();
      stats = created;
    }

    const index = progress?.current_focus_index ?? 0;
    const total = getTotalSteps(problem);
    const isCycleComplete = !!progress?.cycle_completed_at;

    return NextResponse.json({
      biggest_problem: problem,
      current_focus_index: index,
      current_focus: getFocusStep(problem, index),
      total_steps: total,
      is_cycle_complete: isCycleComplete,
      stats: {
        focus_completed_count: stats?.focus_completed_count ?? 0,
        current_streak: stats?.current_streak ?? 0,
        best_streak: stats?.best_streak ?? 0,
        last_completed_date: stats?.last_completed_date ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
