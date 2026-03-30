import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getFocusStep, getTotalSteps } from "@/lib/assistant/focus-maps";

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

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
      newIndex = currentIndex + 1;
      justCompleted = true;
      await supabase
        .from("assistant_progress")
        .update({ current_focus_index: newIndex, last_completed_at: now })
        .eq("user_id", user.id);
    } else {
      isCycleComplete = true;
      justCompleted = true;
      await supabase
        .from("assistant_progress")
        .update({ last_completed_at: now, cycle_completed_at: now })
        .eq("user_id", user.id);
    }

    // ── Streak logic ─────────────────────────────────────────────────────────
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

    const today = toDateStr(new Date());
    const lastDate = stats?.last_completed_date ?? null;
    let currentStreak = stats?.current_streak ?? 0;
    let bestStreak = stats?.best_streak ?? 0;
    let streakMessage = "";

    // Always increment focus count
    const newCount = (stats?.focus_completed_count ?? 0) + 1;

    if (lastDate === today) {
      // Already counted today — no streak change
      streakMessage = "Focus completed. Streak already counted for today.";
    } else {
      // Check if yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toDateStr(yesterday);

      if (lastDate === yesterdayStr) {
        currentStreak += 1;
        streakMessage = `Streak continued: ${currentStreak} day${currentStreak !== 1 ? "s" : ""}`;
      } else if (lastDate === null) {
        currentStreak = 1;
        streakMessage = "Streak started: Day 1";
      } else {
        currentStreak = 1;
        streakMessage = "Streak restarted. Begin again today.";
      }

      if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
      }
    }

    await supabase
      .from("assistant_stats")
      .update({
        focus_completed_count: newCount,
        current_streak: currentStreak,
        best_streak: bestStreak,
        last_completed_date: today,
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      current_focus_index: newIndex,
      current_focus: getFocusStep(problem, newIndex),
      total_steps: total,
      is_cycle_complete: isCycleComplete,
      just_completed: justCompleted,
      stats: {
        focus_completed_count: newCount,
        current_streak: currentStreak,
        best_streak: bestStreak,
        last_completed_date: today,
        streak_message: streakMessage,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
