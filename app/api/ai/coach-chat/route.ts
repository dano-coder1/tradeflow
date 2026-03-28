import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChartAnalysis } from "@/types/ai";
import { fetchUserProfile, formatStrategyContext } from "@/lib/trader-profile";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

function buildAnalysisContext(analysis: ChartAnalysis): string {
  const pct = Math.round(analysis.confidence * 100);
  const smc = analysis.smc_reasons;

  return [
    `=== ANALYSIS CONTEXT ===`,
    `Bias: ${analysis.bias.toUpperCase()} | Confidence: ${pct}% | No-Trade: ${analysis.no_trade}`,
    `Decision Zone: ${analysis.decision_zone}`,
    `Sniper Entry: ${analysis.sniper_entry}`,
    `SL: ${analysis.sl} | TP1: ${analysis.tp1} | TP2: ${analysis.tp2} | TP3: ${analysis.tp3}`,
    ``,
    `Long Scenario: ${analysis.long_scenario}`,
    `Short Scenario: ${analysis.short_scenario}`,
    ``,
    `No-Trade Condition: ${analysis.no_trade_condition}`,
    analysis.reason_if_no_trade ? `No-Trade Reason: ${analysis.reason_if_no_trade}` : "",
    ``,
    `SMC Confluence:`,
    `- Liquidity Sweep: ${smc.liquidity_sweep}${analysis.smc_notes.liquidity_sweep ? ` — ${analysis.smc_notes.liquidity_sweep}` : ""}`,
    `- BOS: ${smc.bos}${analysis.smc_notes.bos ? ` — ${analysis.smc_notes.bos}` : ""}`,
    `- CHoCH: ${smc.choch}${analysis.smc_notes.choch ? ` — ${analysis.smc_notes.choch}` : ""}`,
    `- Order Block: ${smc.order_block}${analysis.smc_notes.order_block ? ` — ${analysis.smc_notes.order_block}` : ""}`,
    `- FVG: ${smc.fvg}${analysis.smc_notes.fvg ? ` — ${analysis.smc_notes.fvg}` : ""}`,
    `- HTF Alignment: ${smc.htf_alignment}${analysis.smc_notes.htf_alignment ? ` — ${analysis.smc_notes.htf_alignment}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const BASE_SYSTEM_PROMPT = `You are a blunt, direct trading coach reviewing a specific chart analysis. Your job is to give the trader honest, actionable feedback — not generic advice.

Rules:
- Answer ONLY about this specific analysis. Never give generic trading tips.
- Be direct. No fluff. No "great question". Get to the point immediately.
- If the setup was weak, say so plainly and explain exactly why.
- If something was missing (no sweep, no displacement, mid-range entry), call it out by name.
- Reference specific fields from the analysis (decision_zone, sniper_entry, SL level, confluence gaps).
- Keep answers under 5 sentences unless a detailed breakdown is genuinely needed.
- Never praise mediocre setups. A 52% confidence no-trade is a bad setup — say that.
- Tone: direct coach, not therapist.`;

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
    const {
      analysisId,
      message,
      history,
    }: { analysisId: string; message: string; history: CoachMessage[] } = body;

    if (!analysisId || !message?.trim())
      return NextResponse.json(
        { error: "analysisId and message are required" },
        { status: 400 }
      );

    const { data: run, error: runError } = await supabase
      .from("analysis_runs")
      .select("output_json")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (runError || !run)
      return NextResponse.json({ error: "Analysis not found" }, { status: 404 });

    const analysis = run.output_json as ChartAnalysis;
    const analysisContext = buildAnalysisContext(analysis);

    // Include trader's strategy if available
    const profile = await fetchUserProfile(user.id);
    const strategyContext = profile
      ? `\n\n${formatStrategyContext(profile)}\n\nWhen evaluating this trader's decisions, reference their specific rules and strategy above. If they violated one of their own rules, name it directly.`
      : "";

    const systemContent = `${BASE_SYSTEM_PROMPT}\n\n${analysisContext}${strategyContext}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message.trim() },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages,
      max_tokens: 600,
      temperature: 0.4,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ?? "No response.";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[coach-chat] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
