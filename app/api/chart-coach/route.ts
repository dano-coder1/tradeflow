import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Types ────────────────────────────────────────────────────────────────────

interface CoachSettings {
  methodology: string[];
  concepts: string[];
  responseStyle: string;
  riskStyle: string;
  customRules: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image?: string; // base64 data URL
}

// ── Label maps ───────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  smc: "Smart Money Concepts (BOS, CHoCH, OB, FVG, liquidity)",
  "price-action": "Price Action (candle patterns, key levels, structure)",
  "support-resistance": "Support & Resistance levels",
  indicators: "Technical Indicators (EMA, RSI, MACD)",
  "trend-following": "Trend Following",
  scalping: "Scalping (short-term entries, tight stops)",
  "swing-trading": "Swing Trading (multi-day holds)",
  custom: "Custom methodology defined by the trader",
};

const CONCEPT_LABELS: Record<string, string> = {
  "bos-choch": "BOS / CHoCH structure breaks",
  "order-blocks": "Order Blocks and FVG zones",
  "pdh-pdl": "Previous Day High/Low levels",
  "ema-sma": "EMA / SMA moving averages",
  "rsi-macd": "RSI and MACD momentum",
  liquidity: "Liquidity pools and sweeps",
  "premium-discount": "Premium / Discount zones",
  session: "Session context (London, NY, Asia)",
};

const STYLE_INSTRUCTIONS: Record<string, string> = {
  "short-direct": "Be extremely concise. 2-4 sentences max. No fluff.",
  detailed: "Give thorough analysis with reasoning. Cover multiple confluences.",
  "beginner-friendly": "Explain concepts simply. Define SMC terms when used. Be encouraging but honest.",
  "advanced-trader": "Skip basics. Reference exact levels, confluences, and invalidation zones.",
  "sniper-entry": "Focus only on the highest-probability entry. Give exact entry, SL, TP levels.",
  educational: "Teach while analyzing. Explain WHY each confluence matters.",
};

const RISK_INSTRUCTIONS: Record<string, string> = {
  conservative: "Prioritize capital preservation. Only call A+ setups. Suggest wider stops and smaller position sizes.",
  moderate: "Balance risk/reward. Call solid setups with clear invalidation.",
  aggressive: "Focus on maximum R:R. Tight stops, multiple targets. Accept higher win-rate variance.",
};

// ── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(settings: CoachSettings, chartContext: string): string {
  const parts: string[] = [];

  parts.push("You are a trading chart coach analyzing a live chart for the trader. Give honest, actionable feedback based on what you see.");

  // Methodology
  const methods = settings.methodology
    .map((m) => METHOD_LABELS[m])
    .filter(Boolean);
  if (methods.length > 0) {
    parts.push(`\nAnalysis methodology: ${methods.join("; ")}.`);
  }

  // Concepts
  const concepts = settings.concepts
    .map((c) => CONCEPT_LABELS[c])
    .filter(Boolean);
  if (concepts.length > 0) {
    parts.push(`Focus on: ${concepts.join(", ")}.`);
  }

  // Style
  const style = STYLE_INSTRUCTIONS[settings.responseStyle] ?? STYLE_INSTRUCTIONS["short-direct"];
  parts.push(`\nResponse style: ${style}`);

  // Risk
  const risk = RISK_INSTRUCTIONS[settings.riskStyle] ?? RISK_INSTRUCTIONS["moderate"];
  parts.push(`Risk approach: ${risk}`);

  // Custom rules
  if (settings.methodology.includes("custom") && settings.customRules.trim()) {
    parts.push(`\n=== TRADER'S CUSTOM RULES ===\n${settings.customRules.trim()}`);
  }

  // Chart context
  if (chartContext) {
    parts.push(`\n${chartContext}`);
  }

  parts.push("\nRules:\n- Reference specific price levels and structures from the context.\n- If the setup is weak, say so directly.\n- Never give generic trading advice.\n- Stay in character as a direct coach.");

  return parts.join("\n");
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages,
      chartContext,
      coachSettings,
      model: requestedModel,
    }: {
      messages: ChatMessage[];
      chartContext: string;
      coachSettings: CoachSettings;
      model?: string;
    } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(coachSettings, chartContext);

    // Build OpenAI messages with optional vision support
    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of messages) {
      if (msg.role === "assistant") {
        apiMessages.push({ role: "assistant", content: msg.content });
      } else {
        // User message — may have image attachment
        if (msg.image) {
          apiMessages.push({
            role: "user",
            content: [
              { type: "text", text: msg.content },
              { type: "image_url", image_url: { url: msg.image } },
            ],
          });
        } else {
          apiMessages.push({ role: "user", content: msg.content });
        }
      }
    }

    const allowedModels = ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "o4-mini"];
    const model = allowedModels.includes(requestedModel ?? "") ? requestedModel! : "gpt-4.1";

    async function tryComplete(m: string): Promise<string> {
      const completion = await openai.chat.completions.create({
        model: m,
        messages: apiMessages,
        max_tokens: 800,
        temperature: 0.5,
      });
      return completion.choices[0]?.message?.content?.trim() ?? "No response.";
    }

    let reply: string;
    try {
      reply = await tryComplete(model);
    } catch (e) {
      console.warn(`[chart-coach] model ${model} failed, falling back to gpt-4.1`, e);
      reply = await tryComplete("gpt-4.1");
    }

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[chart-coach] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
