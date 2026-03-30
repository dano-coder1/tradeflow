import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { followed, reason } = body;

    if (typeof followed !== "boolean") {
      return NextResponse.json({ error: "'followed' (boolean) is required" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];

    // Check for existing reflection today
    const { data: existing } = await supabase
      .from("assistant_reflection")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Already reflected today" }, { status: 409 });
    }

    // Insert reflection
    const { data: reflection, error: insertErr } = await supabase
      .from("assistant_reflection")
      .insert({
        user_id: user.id,
        date: today,
        followed,
        reason: !followed && reason ? String(reason).trim() : null,
      })
      .select("*")
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });

    // Update stats
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

    const newTotalReflections = (stats?.total_reflections ?? 0) + 1;
    const newHonestCompletions = (stats?.honest_completions ?? 0) + (followed ? 1 : 0);

    await supabase
      .from("assistant_stats")
      .update({
        total_reflections: newTotalReflections,
        honest_completions: newHonestCompletions,
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      reflection,
      stats: {
        total_reflections: newTotalReflections,
        honest_completions: newHonestCompletions,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
