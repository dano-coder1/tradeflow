import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChartAnalysis } from "@/types/ai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Zod schema ───────────────────────────────────────────────────────────────

const SmcReasonsSchema = z.object({
  liquidity_sweep: z.boolean(),
  bos: z.boolean(),
  choch: z.boolean(),
  order_block: z.boolean(),
  fvg: z.boolean(),
  htf_alignment: z.boolean(),
});

const SmcNotesSchema = z.object({
  liquidity_sweep: z.string().optional(),
  bos: z.string().optional(),
  choch: z.string().optional(),
  order_block: z.string().optional(),
  fvg: z.string().optional(),
  htf_alignment: z.string().optional(),
});

const ChartAnalysisSchema = z.object({
  bias: z.enum(["bullish", "bearish", "neutral"]),
  confidence: z.number().min(0).max(1),
  decision_zone: z.string().min(1),
  long_scenario: z.string().min(1),
  short_scenario: z.string().min(1),
  sniper_entry: z.string().min(1),
  sl: z.string().min(1),
  tp1: z.string().min(1),
  tp2: z.string().min(1),
  tp3: z.string().min(1),
  no_trade: z.boolean(),
  no_trade_condition: z.string().min(1),
  reason_if_no_trade: z.string().optional(),
  reasoning: z.string().optional(),
  smc_reasons: SmcReasonsSchema,
  smc_notes: SmcNotesSchema,
  telegram_block: z.string().min(1),
});

// ─── Safe fallback (returned when model output is invalid or incomplete) ──────

const FALLBACK: ChartAnalysis = {
  bias: "neutral",
  confidence: 0,
  decision_zone: "Unable to determine — chart unclear or insufficient data",
  long_scenario: "No valid long setup could be identified",
  short_scenario: "No valid short setup could be identified",
  sniper_entry: "No sniper entry — output validation failed",
  sl: "N/A",
  tp1: "N/A",
  tp2: "N/A",
  tp3: "N/A",
  no_trade: true,
  no_trade_condition: "AI output was incomplete or failed schema validation",
  reason_if_no_trade:
    "Model returned an incomplete or unvalidatable response. Re-analyze with clearer, higher-timeframe charts.",
  smc_reasons: {
    liquidity_sweep: false,
    bos: false,
    choch: false,
    order_block: false,
    fvg: false,
    htf_alignment: false,
  },
  smc_notes: {},
  telegram_block:
    "⚠️ Analysis failed — output did not pass validation. Please re-analyze with clearer charts.",
};

// ─── Continuation context builder ────────────────────────────────────────────

function buildContinuationContext(prev: ChartAnalysis): string {
  const pct = Math.round(prev.confidence * 100);
  const active = (Object.keys(prev.smc_reasons) as Array<keyof typeof prev.smc_reasons>)
    .filter((k) => prev.smc_reasons[k])
    .join(", ") || "none";

  return `
=== CONTINUATION MODE ===
You previously analyzed this chart and produced the output below. The user has now added a new screenshot. Your task is to REFINE the existing analysis — not restart it from scratch.

PREVIOUS OUTPUT:
- Bias: ${prev.bias.toUpperCase()} | Confidence: ${pct}%
- No Trade: ${prev.no_trade}
- Decision Zone: ${prev.decision_zone}
- Sniper Entry: ${prev.sniper_entry}
- SL: ${prev.sl} | TP1: ${prev.tp1} | TP2: ${prev.tp2} | TP3: ${prev.tp3}
- No-Trade Condition: ${prev.no_trade_condition}
${prev.reason_if_no_trade ? `- No-Trade Reason: ${prev.reason_if_no_trade}` : ""}
- Active SMC confluence: ${active}

REFINEMENT RULES (override base rules only where noted):
1. KEEP the existing bias unless the new screenshot shows unambiguous structural invalidation (a closed BOS candle against it on HTF).
2. If the new screenshot is a lower timeframe view, refine SL/TP to the specific levels now visible — update only those that become more precise.
3. Increase confidence only if the new screenshot adds clear confirming confluence.
4. Decrease confidence and set no_trade:true if the new screenshot reveals contradiction, chop, or missing displacement.
5. If the new screenshot adds no new significant information, return the same analysis — do not invent changes.
6. Populate reason_if_no_trade if confidence drops or no_trade changes.

Analyze ALL screenshots together (previous + new) using both the base SMC rules and the refinement rules above.`;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite SMC (Smart Money Concepts) trading analyst. You produce ONLY high-probability setups. You strongly prefer NO TRADE over a mediocre or uncertain setup — a no_trade output is always better than a hallucinated one.

=== STRICT SMC RULES ===

RULE 1 — HTF BIAS FIRST (non-negotiable)
Establish Daily or Weekly market structure before any LTF analysis. Identify whether price is currently in a premium or discount zone relative to the HTF range. LTF (H1/M15) is used ONLY for entry timing, NEVER to determine bias.

RULE 2 — VALID ENTRY REQUIRES ALL THREE (not two, not one — ALL THREE):
  A. Location — price must be at a valid OB, FVG, or liquidity level in a premium/discount extreme
  B. Structure — confirmed BOS or CHoCH on the entry timeframe (not a wick — a closed candle)
  C. Displacement — strong impulsive move away from the entry level confirming institutional interest

RULE 3 — COUNTER-TREND ENTRIES
  - In a clear HTF downtrend: LONG is only valid as a reactive scalp after sweeping a clean low and showing CHoCH. Mark it explicitly as a scalp, not a full position.
  - In a clear HTF uptrend: SHORT is only valid as a reactive scalp after sweeping a clean high and showing CHoCH.
  - Full directional trades are only valid in the direction of confirmed HTF bias.

RULE 4 — MANDATORY no_trade: true IF ANY OF THESE APPLY
  - Market structure is choppy, ranging, or lacks a clear swing sequence
  - No liquidity sweep visible before the potential entry
  - Displacement is absent (price drifted into the level with small candles)
  - Location is mid-range — not at a premium or discount extreme
  - Multiple timeframes contradict each other with no resolution
  - Chart is unclear, low resolution, or covers insufficient timeframe history

RULE 5 — CONFIDENCE SCORING (assign to "confidence" field, 0.0–1.0)
  0.0–0.29 → Structural clarity absent, no_trade REQUIRED
  0.30–0.49 → Setup exists but lacks full confluence, no_trade REQUIRED
  0.50–0.69 → Moderate confluence, set no_trade: false but warn in no_trade_condition
  0.70–0.84 → Good confluence, sniper entry may be valid
  0.85–1.00 → All three conditions perfectly aligned, sniper entry confirmed

RULE 6 — PRICE LEVELS
  - SL: placed at the invalidation level — below/above the origin of displacement (swing low/high beyond the OB or FVG)
  - TP1: nearest imbalance or minor liquidity target
  - TP2: intermediate level (next swing high/low or OB)
  - TP3: major HTF liquidity target (weekly high/low, deep imbalance)
  - All values must be absolute price numbers from the visible chart — never pips, percentages, or relative descriptions
  - If a level is not visible on the chart, use "N/A"

=== MANDATORY SELF-CHECK (verify before outputting) ===
1. Can I identify the HTF bias from the visible chart? If NO → no_trade: true, confidence ≤ 0.3
2. Is there a visible liquidity sweep on the chart? If NO → no_trade: true, confidence ≤ 0.4
3. Is there clear displacement (impulsive move) from the entry level? If NO → no_trade: true
4. Are my SL/TP values real price levels visible on the chart? If NO → use "N/A"
5. Is confidence below 0.5? If YES → no_trade: true, populate reason_if_no_trade
6. Did I fabricate any level not visible on the chart? If YES → set those fields to "N/A"

Always respond with valid JSON only — no markdown, no text outside the JSON object.`;

const USER_PROMPT = `Analyze the provided chart screenshot(s) using the SMC rules above. Return ONLY this JSON (every field is required):
{
  "bias": "bullish" | "bearish" | "neutral",
  "confidence": <number 0.0–1.0>,
  "decision_zone": "<price range or level where the trade decision must happen>",
  "long_scenario": "<exact conditions that must be met for a valid long — be specific>",
  "short_scenario": "<exact conditions that must be met for a valid short — be specific>",
  "sniper_entry": "<entry trigger + price area, or 'No sniper entry — confidence below threshold'>",
  "sl": "<absolute price level or 'N/A'>",
  "tp1": "<absolute price level or 'N/A'>",
  "tp2": "<absolute price level or 'N/A'>",
  "tp3": "<absolute price level or 'N/A'>",
  "no_trade": <true | false>,
  "no_trade_condition": "<what would fully invalidate this setup>",
  "reason_if_no_trade": "<required when no_trade is true: specific SMC reason — which rule was not met>",
  "reasoning": "<2-3 sentences synthesizing the SMC logic — what confluence is present or absent and why this is or isn't a valid setup>",
  "smc_reasons": {
    "liquidity_sweep": <true | false>,
    "bos": <true | false>,
    "choch": <true | false>,
    "order_block": <true | false>,
    "fvg": <true | false>,
    "htf_alignment": <true | false>
  },
  "smc_notes": {
    "liquidity_sweep": "<describe the sweep if detected>",
    "bos": "<describe the BOS if detected>",
    "choch": "<describe the CHoCH if detected>",
    "order_block": "<describe the OB if detected>",
    "fvg": "<describe the FVG if detected>",
    "htf_alignment": "<describe the HTF context if detected>"
  },
  "telegram_block": "<single concise summary sentence — the frontend will format the full Telegram message from structured fields>"
}`;

// ─── Handler ──────────────────────────────────────────────────────────────────

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
      imageUrls,
      previousAnalysis,
      analysisId: incomingAnalysisId,
    } = body as {
      imageUrls: string[];
      previousAnalysis?: ChartAnalysis;
      analysisId?: string;
    };

    if (!Array.isArray(imageUrls) || imageUrls.length === 0)
      return NextResponse.json(
        { error: "At least one imageUrl is required" },
        { status: 400 }
      );
    if (imageUrls.length > 6)
      return NextResponse.json(
        { error: "Maximum 6 images allowed" },
        { status: 400 }
      );

    const imageContent = imageUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url, detail: "high" as const },
    }));

    const systemContent = previousAnalysis
      ? SYSTEM_PROMPT + "\n" + buildContinuationContext(previousAnalysis)
      : SYSTEM_PROMPT;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemContent },
        {
          role: "user",
          content: [
            { type: "text" as const, text: USER_PROMPT },
            ...imageContent,
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1800,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[analyze-chart] JSON.parse failed, returning fallback");
      return NextResponse.json(FALLBACK);
    }

    const validated = ChartAnalysisSchema.safeParse(parsed);
    if (!validated.success) {
      console.warn(
        "[analyze-chart] schema validation failed:",
        validated.error.issues
      );
      return NextResponse.json(FALLBACK);
    }

    let analysis = validated.data;

    // Server-side enforcement: confidence < 0.5 → force no_trade
    if (analysis.confidence < 0.5 && !analysis.no_trade) {
      analysis = {
        ...analysis,
        no_trade: true,
        reason_if_no_trade:
          analysis.reason_if_no_trade ??
          `Confidence ${(analysis.confidence * 100).toFixed(0)}% is below the 50% threshold — setup not clean enough to trade.`,
      };
    }

    // Persist to analysis_runs (best-effort — never block the response)
    let analysisId: string | null = null;
    const payload = {
      image_urls: imageUrls,
      output_json: analysis,
      bias: analysis.bias,
      no_trade: analysis.no_trade,
      telegram_block: analysis.telegram_block,
    };
    try {
      if (incomingAnalysisId) {
        // Continuation: UPDATE existing record (verify ownership first)
        const { error: updateError } = await supabase
          .from("analysis_runs")
          .update(payload)
          .eq("id", incomingAnalysisId)
          .eq("user_id", user.id);

        if (updateError) {
          console.warn("[analyze-chart] update failed:", updateError.message);
        } else {
          analysisId = incomingAnalysisId;
        }
      } else {
        // Fresh analysis: INSERT new record
        const { data: saved, error: insertError } = await supabase
          .from("analysis_runs")
          .insert({ user_id: user.id, ...payload })
          .select("id")
          .single();

        if (insertError) {
          console.warn("[analyze-chart] insert failed:", insertError.message);
        } else {
          analysisId = saved.id as string;
        }
      }
    } catch (saveEx) {
      console.warn("[analyze-chart] save exception:", saveEx);
    }

    return NextResponse.json({ ...analysis, analysisId });
  } catch (e) {
    console.error("[analyze-chart] error:", e);
    return NextResponse.json(FALLBACK);
  }
}
