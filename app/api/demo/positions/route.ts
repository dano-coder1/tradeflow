import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accountId = req.nextUrl.searchParams.get("account_id");

    let query = supabase
      .from("demo_positions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("opened_at", { ascending: false });

    if (accountId) query = query.eq("account_id", accountId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ positions: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
