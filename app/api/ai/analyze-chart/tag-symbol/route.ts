import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { analysisId, symbol } = body as { analysisId: string; symbol: string };

  if (!analysisId || !symbol)
    return NextResponse.json({ error: "analysisId and symbol required" }, { status: 400 });

  const normalized = symbol.trim().toUpperCase();

  const { error } = await supabase
    .from("analysis_runs")
    .update({ symbol: normalized })
    .eq("id", analysisId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[tag-symbol] update error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, symbol: normalized });
}
