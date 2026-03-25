import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("[tag-symbol] auth failed:", userError?.message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { analysisId, symbol } = body as { analysisId: string; symbol: string };
  console.log("[tag-symbol] received:", { analysisId, symbol, userId: user.id });

  if (!analysisId || !symbol)
    return NextResponse.json({ error: "analysisId and symbol required" }, { status: 400 });

  const normalized = symbol.trim().toUpperCase();

  // Fetch current output_json so we can merge _symbol into it.
  // Stores symbol inside the existing JSONB column — no schema migration needed.
  const { data: current, error: fetchError } = await supabase
    .from("analysis_runs")
    .select("output_json")
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !current) {
    console.error("[tag-symbol] fetch failed:", fetchError?.message, "| analysisId:", analysisId);
    return NextResponse.json(
      { error: fetchError?.message ?? "Analysis not found" },
      { status: 404 }
    );
  }

  console.log("[tag-symbol] fetched analysis, merging _symbol:", normalized);

  const updatedJson = { ...(current.output_json as object), _symbol: normalized };

  const { error: updateError } = await supabase
    .from("analysis_runs")
    .update({ output_json: updatedJson })
    .eq("id", analysisId)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[tag-symbol] update error:", updateError.message);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  console.log("[tag-symbol] saved successfully:", { analysisId, symbol: normalized });
  return NextResponse.json({ ok: true, symbol: normalized });
}
