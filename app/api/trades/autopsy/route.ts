import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are an expert trading coach performing a post-trade autopsy.
Analyze this trade objectively and specifically.
Reference the actual numbers provided.
Do not be generic.
If important context is missing, say so clearly in the verdict and lower confidence.
Do not invent reasons not supported by the provided trade data.

Return ONLY valid JSON matching this schema:
{
  "verdict": "Win/Loss/Breakeven — one sentence explaining why",
  "confidence": "high" | "medium" | "low",
  "what_went_well": ["max 3 positives"],
  "what_went_wrong": ["max 3 mistakes"],
  "key_mistake": "single biggest mistake or null if clean",
  "improvement_tip": "one specific actionable tip",
  "behavior_tags": ["tags from allowed list"]
}

Allowed behavior_tags:
late_entry, no_confirmation, buy_in_premium, sell_in_discount,
liquidity_not_taken, entered_before_bos, revenge_trade, bad_rr,
overtrading, good_patience, correct_invalidation, clean_execution,
sl_too_tight, tp_too_early, wrong_bias, good_risk_management

Return ONLY valid JSON, no markdown fences.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tradeId } = await req.json();
    if (!tradeId) return NextResponse.json({ error: "tradeId required" }, { status: 400 });

    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .eq("user_id", user.id)
      .single();

    if (tradeError || !trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

    // Build trade context
    const parts: string[] = [
      `Symbol: ${trade.symbol}`,
      `Direction: ${trade.direction}`,
      `Entry: ${trade.entry ?? "N/A"}`,
      `Exit: ${trade.exit ?? "N/A"}`,
      `SL: ${trade.sl ?? "N/A"}`,
      `TP: ${trade.tp ?? "N/A"}`,
      `PnL: ${trade.pnl ?? "N/A"}`,
      `R:R: ${trade.rr ?? "N/A"}`,
      `Result: ${trade.result ?? "N/A"}`,
      `Status: ${trade.status}`,
      `Date: ${trade.trade_date}`,
      `Timeframe: ${trade.timeframe ?? "N/A"}`,
      `Tag/Setup: ${trade.tag ?? "N/A"}`,
      `Notes: ${trade.notes ?? "N/A"}`,
    ];
    if (trade.size) parts.push(`Size: ${trade.size}`);
    if (trade.risk_amount) parts.push(`Risk Amount: ${trade.risk_amount}`);
    if (trade.ai_review_summary) parts.push(`Previous AI Review: ${trade.ai_review_summary}`);

    const tradeContext = parts.join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Perform an autopsy on this trade:\n\n${tradeContext}` },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 502 });
    }

    // Add timestamp
    result.generated_at = new Date().toISOString();

    // Save to database
    const { error: updateError } = await supabase
      .from("trades")
      .update({ autopsy_json: result })
      .eq("id", tradeId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[autopsy] save error:", updateError);
      // Still return the result even if save fails
    }

    return NextResponse.json({ autopsy: result, saved: !updateError });
  } catch (e) {
    console.error("[autopsy] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
