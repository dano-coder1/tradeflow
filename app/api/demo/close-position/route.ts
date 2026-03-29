import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { position_id, exit_price, close_reason } = body;

    if (!position_id || exit_price == null) {
      return NextResponse.json({ error: "Missing required fields: position_id, exit_price" }, { status: 400 });
    }

    // Fetch position
    const { data: pos, error: posErr } = await supabase
      .from("demo_positions")
      .select("*")
      .eq("id", position_id)
      .eq("user_id", user.id)
      .eq("status", "open")
      .single();

    if (posErr || !pos) {
      return NextResponse.json({ error: "Position not found or already closed" }, { status: 404 });
    }

    // Calculate PnL
    const exitP = Number(exit_price);
    const entryP = Number(pos.entry_price);
    const sz = Number(pos.size);
    const rawPnl = pos.direction === "buy"
      ? (exitP - entryP) * sz
      : (entryP - exitP) * sz;
    const pnl = Number(rawPnl.toFixed(2));

    const reason = close_reason && ["manual", "sl", "tp"].includes(close_reason)
      ? close_reason
      : "manual";

    // 1. Insert into demo_trades
    const { data: trade, error: tradeErr } = await supabase
      .from("demo_trades")
      .insert({
        account_id: pos.account_id,
        user_id: user.id,
        symbol: pos.symbol,
        direction: pos.direction,
        size: sz,
        entry_price: entryP,
        exit_price: exitP,
        sl: pos.sl,
        tp: pos.tp,
        pnl,
        opened_at: pos.opened_at,
        close_reason: reason,
      })
      .select("*")
      .single();

    if (tradeErr) return NextResponse.json({ error: tradeErr.message }, { status: 400 });

    // 2. Delete position
    await supabase
      .from("demo_positions")
      .delete()
      .eq("id", position_id);

    // 3. Update account balance
    const { data: account } = await supabase
      .from("demo_accounts")
      .select("balance")
      .eq("id", pos.account_id)
      .single();

    if (account) {
      const newBalance = Number(account.balance) + pnl;
      await supabase
        .from("demo_accounts")
        .update({ balance: newBalance, equity: newBalance })
        .eq("id", pos.account_id);
    }

    // 4. Optionally mirror to main trades table with source = 'sim'
    const direction = pos.direction === "buy" ? "long" : "short";
    const tradeResult = pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";

    await supabase
      .from("trades")
      .insert({
        user_id: user.id,
        symbol: pos.symbol,
        direction,
        entry: entryP,
        exit: exitP,
        sl: pos.sl,
        tp: pos.tp,
        size: sz,
        pnl,
        rr: pos.sl ? Number(Math.abs((exitP - entryP) / (entryP - Number(pos.sl))).toFixed(2)) : null,
        status: "closed",
        result: tradeResult,
        source: "sim",
        ai_extracted: false,
        trade_date: new Date().toISOString().split("T")[0],
      });

    return NextResponse.json({ trade, pnl });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
