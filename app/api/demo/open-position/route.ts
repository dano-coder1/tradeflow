import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { symbol, direction, size, entry_price, sl, tp, account_id } = body;

    // Validate required fields
    if (!symbol || !direction || !size || !entry_price || !account_id) {
      return NextResponse.json({ error: "Missing required fields: symbol, direction, size, entry_price, account_id" }, { status: 400 });
    }

    if (!["buy", "sell"].includes(direction)) {
      return NextResponse.json({ error: "Direction must be 'buy' or 'sell'" }, { status: 400 });
    }

    if (Number(size) <= 0 || Number(entry_price) <= 0) {
      return NextResponse.json({ error: "Size and entry_price must be positive" }, { status: 400 });
    }

    // Verify account belongs to user
    const { data: account, error: accErr } = await supabase
      .from("demo_accounts")
      .select("id, balance")
      .eq("id", account_id)
      .eq("user_id", user.id)
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: "Demo account not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("demo_positions")
      .insert({
        account_id,
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        direction,
        size: Number(size),
        entry_price: Number(entry_price),
        sl: sl != null ? Number(sl) : null,
        tp: tp != null ? Number(tp) : null,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
