import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BEHAVIOR_TAGS = `late_entry, no_confirmation, buy_in_premium, sell_in_discount,
liquidity_not_taken, entered_before_bos, revenge_trade, bad_rr,
overtrading, good_patience, correct_invalidation, clean_execution,
sl_too_tight, tp_too_early, wrong_bias, good_risk_management`;

function buildPrompt(mode: "review" | "autopsy"): string {
  const depth = mode === "review"
    ? "Provide a concise trade review. Keep it brief — 1-2 items per section max."
    : "Perform a thorough post-trade autopsy. Be detailed — up to 3 items per section.";

  return `You are an expert trading coach analyzing a completed trade.
${depth}
Analyze objectively and specifically. Reference the actual numbers provided.
Do not be generic. If important context is missing, say so and lower confidence.
Do not invent reasons not supported by the provided trade data.

Return ONLY valid JSON matching this schema:
{
  "mode": "${mode}",
  "verdict": "Win/Loss/Breakeven — one sentence explaining why",
  "confidence": "high" | "medium" | "low",
  "summary": "2-3 sentence overview of the trade quality",
  "what_went_well": ["positives"],
  "what_went_wrong": ["mistakes"],
  "key_mistake": "single biggest mistake or null if clean trade",
  "improvement_tip": "one specific actionable tip for next time",
  "behavior_tags": ["tags from allowed list"]
}

Allowed behavior_tags:
${BEHAVIOR_TAGS}

Return ONLY valid JSON, no markdown fences.`;
}

function buildTradeContext(trade: Record<string, unknown>): string {
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
  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { tradeId, mode = "review" } = body as { tradeId: string; mode?: "review" | "autopsy" };
    if (!tradeId) return NextResponse.json({ error: "tradeId required" }, { status: 400 });

    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .eq("user_id", user.id)
      .single();

    if (tradeError || !trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

    const tradeContext = buildTradeContext(trade);
    const systemPrompt = buildPrompt(mode);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    // Use vision if screenshot exists
    if (trade.screenshot_url) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: `Analyze this trade:\n\n${tradeContext}` },
          { type: "image_url", image_url: { url: trade.screenshot_url, detail: "high" } },
        ],
      });
    } else {
      messages.push({ role: "user", content: `Analyze this trade:\n\n${tradeContext}` });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages,
      max_tokens: mode === "review" ? 500 : 800,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 502 });
    }

    // Ensure required fields
    result.mode = mode;
    result.generated_at = new Date().toISOString();

    // Save to database — unified field
    const updatePayload: Record<string, unknown> = {
      autopsy_json: result,
      ai_review_status: "done",
      ai_review_summary: result.summary ?? result.verdict,
    };

    const { error: updateError } = await supabase
      .from("trades")
      .update(updatePayload)
      .eq("id", tradeId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[trade-review] save error:", updateError);
    }

    return NextResponse.json({ review: result, saved: !updateError });
  } catch (e) {
    console.error("[trade-review] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
