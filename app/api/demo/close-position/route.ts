import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calculateDemoPnL, requiredMargin } from "@/lib/trading/instruments";

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

    // Calculate PnL (leverage does NOT affect PnL)
    const exitP = Number(exit_price);
    const entryP = Number(pos.entry_price);
    const lots = Number(pos.size);
    const contractSize = Number(pos.contract_size);

    const pnl = calculateDemoPnL(
      pos.direction as "buy" | "sell",
      entryP,
      exitP,
      lots,
      contractSize,
    );

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
        size: lots,
        entry_price: entryP,
        exit_price: exitP,
        contract_size: contractSize,
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

    // 3. Update account: balance += pnl, release margin, recalc equity
    const { data: account } = await supabase
      .from("demo_accounts")
      .select("balance, used_margin, leverage")
      .eq("id", pos.account_id)
      .single();

    if (account) {
      const oldBalance = Number(account.balance);
      const oldUsedMargin = Number(account.used_margin);
      const leverage = account.leverage || 100;

      // Margin that was locked for this position
      const positionMargin = requiredMargin(lots, contractSize, entryP, leverage);

      const newBalance = oldBalance + pnl;
      const newUsedMargin = Math.max(0, oldUsedMargin - positionMargin);
      const newEquity = newBalance; // no open positions' floating PnL in DB — computed client-side

      await supabase
        .from("demo_accounts")
        .update({
          balance: Number(newBalance.toFixed(2)),
          equity: Number(newEquity.toFixed(2)),
          used_margin: Number(newUsedMargin.toFixed(2)),
        })
        .eq("id", pos.account_id);
    }

    // 4. Mirror to main trades table with source = 'sim'
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
        size: lots,
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
