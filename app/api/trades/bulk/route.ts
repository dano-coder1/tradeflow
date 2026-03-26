import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface BulkTrade {
  symbol: string;
  direction: "LONG" | "SHORT";
  size: number | null;
  entry: number | null;
  exit: number | null;
  pnl: number | null;
  date: string | null;
}

function getResult(pnl: number | null): "win" | "loss" | "breakeven" | null {
  if (pnl === null) return null;
  if (pnl > 0) return "win";
  if (pnl < 0) return "loss";
  return "breakeven";
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
    const { trades }: { trades: BulkTrade[] } = body;

    if (!Array.isArray(trades) || trades.length === 0)
      return NextResponse.json({ error: "trades array is required" }, { status: 400 });

    const rows = trades
      .filter((t) => t.symbol && t.direction)
      .map((t) => ({
        user_id: user.id,
        symbol: t.symbol.toUpperCase(),
        direction: t.direction.toLowerCase() as "long" | "short",
        size: t.size,
        entry: t.entry,
        exit: t.exit,
        pnl: t.pnl,
        result: getResult(t.pnl),
        status: "closed" as const,
        trade_date: t.date || new Date().toISOString().slice(0, 10),
        ai_extracted: true,
        notes: "Imported from MT5 screenshot",
      }));

    if (rows.length === 0)
      return NextResponse.json({ error: "No valid trades to import" }, { status: 400 });

    const { data, error } = await supabase.from("trades").insert(rows).select("id");

    if (error) {
      console.error("[bulk] insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ imported: data?.length ?? 0 });
  } catch (e) {
    console.error("[bulk] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
