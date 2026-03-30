import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_ACCOUNTS = 5;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const balance = Number(body.balance);
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Demo Account";
    const currency = typeof body.currency === "string" ? body.currency : "USD";
    const leverage = Number(body.leverage) || 100;

    if (!balance || balance < 100 || balance > 10_000_000) {
      return NextResponse.json({ error: "Balance must be between 100 and 10,000,000" }, { status: 400 });
    }

    if (leverage < 10 || leverage > 2000) {
      return NextResponse.json({ error: "Leverage must be between 10 and 2000" }, { status: 400 });
    }

    // Cap at MAX_ACCOUNTS per user
    const { count } = await supabase
      .from("demo_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= MAX_ACCOUNTS) {
      return NextResponse.json({ error: `Maximum ${MAX_ACCOUNTS} demo accounts allowed` }, { status: 409 });
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
