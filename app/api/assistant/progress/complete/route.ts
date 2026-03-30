import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFocusStep, getTotalSteps } from "@/lib/assistant/focus-maps";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Load assistant profile
    const { data: profile } = await supabase
      .from("assistant_profiles")
      .select("biggest_problem")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "No assistant profile" }, { status: 404 });
    }

    const problem = profile.biggest_problem || "default";
    const total = getTotalSteps(problem);

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

    const currentIndex = progress?.current_focus_index ?? 0;
    const now = new Date().toISOString();
    let newIndex = currentIndex;
    let isCycleComplete = false;
    let justCompleted = false;

    if (currentIndex < total - 1) {
      // Advance to next step
      newIndex = currentIndex + 1;
      justCompleted = true;
      await supabase
        .from("assistant_progress")
        .update({ current_focus_index: newIndex, last_completed_at: now })
        .eq("user_id", user.id);
    } else {
      // Final step completed — mark cycle done
      isCycleComplete = true;
      justCompleted = true;
      await supabase
        .from("assistant_progress")
        .update({ last_completed_at: now, cycle_completed_at: now })
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      current_focus_index: newIndex,
      current_focus: getFocusStep(problem, newIndex),
      total_steps: total,
      is_cycle_complete: isCycleComplete,
      just_completed: justCompleted,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
