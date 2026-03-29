import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface CSVTrade {
  symbol: string;
  direction: "buy" | "sell";
  entry_price: number | null;
  exit_price: number | null;
  entry_time: string | null;
  exit_time: string | null;
  profit_loss: number | null;
  volume: number | null;
}

function getResult(pnl: number | null): "win" | "loss" | "breakeven" | null {
  if (pnl === null) return null;
  if (pnl > 0) return "win";
  if (pnl < 0) return "loss";
  return "breakeven";
}

function mapDirection(d: "buy" | "sell"): "long" | "short" {
  return d === "buy" ? "long" : "short";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { trades }: { trades: CSVTrade[] } = body;

    if (!Array.isArray(trades) || trades.length === 0)
      return NextResponse.json({ error: "trades array is required" }, { status: 400 });

    // Fetch existing trades for duplicate detection
    const { data: existingTrades } = await supabase
      .from("trades")
      .select("symbol, entry, exit, direction, trade_date")
      .eq("user_id", user.id);

    const existingKeys = new Set(
      (existingTrades ?? []).map(
        (t) => `${t.symbol}|${t.entry}|${t.exit}|${t.direction}|${t.trade_date}`
      )
    );

    const rows = trades
      .filter((t) => t.symbol && t.direction)
      .map((t) => {
        const direction = mapDirection(t.direction);
        const tradeDate = t.entry_time
          ? new Date(t.entry_time).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        return {
          user_id: user.id,
          symbol: t.symbol.toUpperCase(),
          direction,
          size: t.volume,
          entry: t.entry_price,
          exit: t.exit_price,
          pnl: t.profit_loss,
          result: getResult(t.profit_loss),
          status: "closed" as const,
          trade_date: tradeDate,
          ai_extracted: true,
          notes: "Imported from broker CSV",
        };
      });

    // Filter out duplicates
    const uniqueRows = rows.filter((r) => {
      const key = `${r.symbol}|${r.entry}|${r.exit}|${r.direction}|${r.trade_date}`;
      return !existingKeys.has(key);
    });

    const skipped = rows.length - uniqueRows.length;

    if (uniqueRows.length === 0)
      return NextResponse.json({ saved: 0, skipped });

    const { data, error } = await supabase
      .from("trades")
      .insert(uniqueRows)
      .select("id");

    if (error) {
      console.error("[csv-save] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ saved: data?.length ?? 0, skipped });
  } catch (e) {
    console.error("[csv-save] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
