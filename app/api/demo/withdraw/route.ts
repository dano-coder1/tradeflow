import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { account_id, amount } = body;
    const withdrawal = Number(amount);

    if (!account_id || !withdrawal || withdrawal <= 0) {
      return NextResponse.json({ error: "account_id and positive amount required" }, { status: 400 });
    }

    const { data: account, error: accErr } = await supabase
      .from("demo_accounts")
      .select("balance, equity, used_margin")
      .eq("id", account_id)
      .eq("user_id", user.id)
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const freeMargin = Number(account.equity) - Number(account.used_margin);

    if (withdrawal > freeMargin) {
      return NextResponse.json({
        error: `Cannot withdraw more than free margin ($${freeMargin.toFixed(2)})`,
      }, { status: 400 });
    }

    const newBalance = Number(account.balance) - withdrawal;
    const newEquity = Number(account.equity) - withdrawal;

    const { error } = await supabase
      .from("demo_accounts")
      .update({
        balance: Number(newBalance.toFixed(2)),
        equity: Number(newEquity.toFixed(2)),
      })
      .eq("id", account_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ balance: newBalance });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
