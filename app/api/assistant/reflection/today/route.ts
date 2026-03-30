import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("assistant_reflection")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    // Check if user completed a focus step today
    const { data: progress } = await supabase
      .from("assistant_progress")
      .select("last_completed_at")
      .eq("user_id", user.id)
      .single();

    const completedToday = progress?.last_completed_at
      ? progress.last_completed_at.startsWith(today)
      : false;

    return NextResponse.json({
      reflection: data ?? null,
      completed_focus_today: completedToday,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
