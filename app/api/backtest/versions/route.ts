import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET — fetch versions for a strategy
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const strategyId = req.nextUrl.searchParams.get("strategy_id");
    if (!strategyId) return NextResponse.json({ error: "strategy_id required" }, { status: 400 });

    const { data, error } = await supabase
      .from("strategy_versions")
      .select("id, strategy_id, version_number, name, dsl, change_summary, source_type, created_at")
      .eq("strategy_id", strategyId)
      .eq("user_id", user.id)
      .order("version_number", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — save a new version
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { strategy_id, dsl, change_summary, source_type, name } = body as {
      strategy_id: string;
      dsl: Record<string, unknown>;
      change_summary?: Record<string, unknown>[];
      source_type?: string;
      name?: string;
    };

    if (!strategy_id || !dsl) {
      return NextResponse.json({ error: "strategy_id and dsl required" }, { status: 400 });
    }

    // Get next version number
    const { data: existing } = await supabase
      .from("strategy_versions")
      .select("version_number")
      .eq("strategy_id", strategy_id)
      .eq("user_id", user.id)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersion = (existing?.[0]?.version_number ?? 0) + 1;

    const { data, error } = await supabase
      .from("strategy_versions")
      .insert({
        strategy_id,
        user_id: user.id,
        version_number: nextVersion,
        name: name ?? `v${nextVersion}`,
        dsl,
        change_summary: change_summary ?? null,
        source_type: source_type ?? "improved",
      })
      .select("id, version_number, name, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
