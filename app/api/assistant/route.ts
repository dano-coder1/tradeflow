import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function deriveMode(level: string, goal: string, problem: string): string {
  if (level === "beginner") return "beginner_coach";
  if (problem === "emotions" || problem === "overtrading") return "discipline_coach";
  if (goal === "improve_entries" || problem === "late_entries") return "execution_coach";
  if (goal === "build_system" || goal === "become_consistent") return "strategy_mentor";
  return "general_coach";
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("assistant_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ profile: data ?? null });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      experience_level = "beginner",
      primary_goal = "",
      biggest_problem = "",
      communication_style = "",
      focus_area = "",
    } = body;

    const assistant_mode = deriveMode(experience_level, primary_goal, biggest_problem);

    const { data, error } = await supabase
      .from("assistant_profiles")
      .upsert({
        user_id: user.id,
        experience_level,
        primary_goal,
        biggest_problem,
        communication_style,
        focus_area,
        assistant_mode,
        onboarding_completed: true,
      }, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ profile: data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
