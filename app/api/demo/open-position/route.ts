import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getInstrument,
  validateLotSize,
  requiredMargin,
} from "@/lib/trading/instruments";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { symbol, direction, size, entry_price, sl, tp, account_id } = body;

    if (!symbol || !direction || !size || !entry_price || !account_id) {
      return NextResponse.json({ error: "Missing required fields: symbol, direction, size, entry_price, account_id" }, { status: 400 });
    }

    if (!["buy", "sell"].includes(direction)) {
      return NextResponse.json({ error: "Direction must be 'buy' or 'sell'" }, { status: 400 });
    }

    const lots = Number(size);
    const price = Number(entry_price);
    if (lots <= 0 || price <= 0) {
      return NextResponse.json({ error: "Size and entry_price must be positive" }, { status: 400 });
    }

    const instrument = getInstrument(symbol);

    const lotError = validateLotSize(lots, instrument);
    if (lotError) {
      return NextResponse.json({ error: lotError }, { status: 400 });
    }

    // Fetch account with margin info
    const { data: account, error: accErr } = await supabase
      .from("demo_accounts")
      .select("id, balance, equity, leverage, used_margin")
      .eq("id", account_id)
      .eq("user_id", user.id)
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: "Demo account not found" }, { status: 404 });
    }

    const leverage = account.leverage || 100;
    const margin = requiredMargin(lots, instrument.contract_size, price, leverage);
    const usedMargin = Number(account.used_margin);
    const equity = Number(account.equity);
    const freeMargin = equity - usedMargin;

    if (margin > freeMargin) {
      return NextResponse.json({
        error: `Insufficient free margin. Required: $${margin.toFixed(2)}, Free: $${freeMargin.toFixed(2)}`,
      }, { status: 400 });
    }

    // Insert position
    const { data, error } = await supabase
      .from("demo_positions")
      .insert({
        account_id,
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        direction,
        size: lots,
        entry_price: price,
        contract_size: instrument.contract_size,
        sl: sl != null ? Number(sl) : null,
        tp: tp != null ? Number(tp) : null,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Update used_margin on account
    const newUsedMargin = usedMargin + margin;
    await supabase
      .from("demo_accounts")
      .update({ used_margin: Number(newUsedMargin.toFixed(2)) })
      .eq("id", account_id);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
