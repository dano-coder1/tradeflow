import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("demo_accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ accounts: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
