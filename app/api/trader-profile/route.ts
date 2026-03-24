import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("trader_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json(profile ?? null);
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { style, experience_level, strategy_json, strategy_text } = body;

  if (!style || !experience_level || !strategy_json)
    return NextResponse.json(
      { error: "style, experience_level, and strategy_json are required" },
      { status: 400 }
    );

  const { data, error } = await supabase
    .from("trader_profiles")
    .upsert(
      {
        user_id: user.id,
        style,
        experience_level,
        strategy_json,
        strategy_text: strategy_text ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
