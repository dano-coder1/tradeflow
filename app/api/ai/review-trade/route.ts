import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ReviewTradeResponse } from "@/types/ai";
import { fetchUserProfile, formatStrategyContext } from "@/lib/trader-profile";
import { TraderProfile } from "@/types/trader-profile";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BASE_SYSTEM_PROMPT = `You are an expert trading coach and analyst.
Review the trader's trade and provide detailed, honest, actionable feedback.
Always respond with valid JSON only — no markdown, no commentary outside the JSON object.`;

function buildUserPrompt(
  trade: Record<string, unknown>,
  profile: TraderProfile | null
): string {
  const strategyBlock = profile
    ? `\n\n${formatStrategyContext(profile)}\n\nIMPORTANT: Evaluate this trade against the trader's OWN rules above. rule_adherence_score, execution_score, and discipline_score must reflect adherence to their specific strategy — not generic principles. mistake_tags should reference their actual rule violations.`
    : "";

  const autopsyFields = profile
    ? `,
  "rule_adherence_score": <1-10 — how well did they follow their own entry/confirmation rules>,
  "execution_score": <1-10 — quality of execution timing and price>,
  "discipline_score": <1-10 — emotional discipline, rule adherence, no impulsive decisions>,
  "mistake_tags": ["tag1", "tag2"] (e.g. "early entry", "chased price", "no confirmation", "oversized", "moved SL"),
  "pattern_detection": ["pattern1"] (recurring patterns if visible — e.g. "enters before sweep", "takes TP too early")`
    : "";

  return `Review this trade and respond with a JSON object matching this exact structure:
{
  "summary": "2-3 sentence overview of the trade",
  "setup_quality": <1-10>,
  "entry_quality": <1-10>,
  "risk_management": <1-10>,
  "strengths": ["strength 1", "strength 2"],
  "mistakes": ["mistake 1", "mistake 2"],
  "detected_smc_elements": {
    "bos": <true/false>,
    "choch": <true/false>,
    "liquidity_sweep": <true/false>,
    "order_block": <true/false>,
    "fvg": <true/false>,
    "premium_discount_context": <true/false>,
    "unclear_structure": <true/false>
  },
  "execution_feedback": {
    "entry_was_late": <true/false>,
    "sl_too_tight": <true/false>,
    "tp_realistic": <true/false>,
    "rr_good": <true/false>
  },
  "coach_note": "personal message with the most important lesson"${autopsyFields}
}

Trade data:
- Symbol: ${trade.symbol}
- Direction: ${trade.direction}
- Entry: ${trade.entry ?? "not provided"}
- Stop Loss: ${trade.sl ?? "not provided"}
- Take Profit: ${trade.tp ?? "not provided"}
- Exit: ${trade.exit ?? "not provided"}
- R:R: ${trade.rr ?? "not calculated"}
- Result: ${trade.result ?? "open"}
- Timeframe: ${trade.timeframe ?? "not provided"}
- Tag/Setup: ${trade.tag ?? "not provided"}
- Notes: ${trade.notes ?? "none"}${strategyBlock}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tradeId } = body as { tradeId: string };
  if (!tradeId)
    return NextResponse.json({ error: "tradeId required" }, { status: 400 });

  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .select("*")
    .eq("id", tradeId)
    .eq("user_id", user.id)
    .single();

  if (tradeError || !trade)
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  await supabase
    .from("trades")
    .update({ ai_review_status: "processing" })
    .eq("id", tradeId);

  // Fetch trader profile (best-effort — reviews work without it)
  const profile = await fetchUserProfile(user.id);

  try {
    const userPrompt = buildUserPrompt(trade, profile);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: BASE_SYSTEM_PROMPT },
      {
        role: "user",
        content: trade.screenshot_url
          ? [
              { type: "text" as const, text: userPrompt },
              {
                type: "image_url" as const,
                image_url: {
                  url: trade.screenshot_url as string,
                  detail: "high" as const,
                },
              },
            ]
          : userPrompt,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const review = JSON.parse(raw) as ReviewTradeResponse;

    await supabase
      .from("trades")
      .update({
        ai_review_status: "done",
        ai_review_summary: review.summary,
        ai_review_json: review,
      })
      .eq("id", tradeId);

    return NextResponse.json(review);
  } catch (e) {
    console.error("[review-trade] error:", e);
    await supabase
      .from("trades")
      .update({ ai_review_status: "failed" })
      .eq("id", tradeId);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
