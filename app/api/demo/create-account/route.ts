import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const balance = Number(body.balance);
    const name = typeof body.name === "string" ? body.name.trim() : "Demo Account";
    const currency = typeof body.currency === "string" ? body.currency : "USD";
    const leverage = Number(body.leverage) || 100;

    if (!balance || balance < 100 || balance > 10_000_000) {
      return NextResponse.json({ error: "Balance must be between 100 and 10,000,000" }, { status: 400 });
    }

    // Only allow 1 demo account per user for now
    const { data: existing } = await supabase
      .from("demo_accounts")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Demo account already exists", id: existing[0].id }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("demo_accounts")
      .insert({
        user_id: user.id,
        name,
        currency,
        leverage,
        starting_balance: balance,
        balance,
        equity: balance,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
