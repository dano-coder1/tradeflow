import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are a trading strategy parser for TradeFlow.

Convert the user's strategy description into valid JSON only.

Return one of these two JSON shapes only:

1) Success:
{
  "dsl": {
    "market": "XAUUSD",
    "timeframe": "15m",
    "entry": {
      "direction": "long",
      "conditions": [
        {"type": "ema_cross", "fast": 20, "slow": 50},
        {"type": "rsi_above", "period": 14, "value": 50}
      ]
    },
    "exit": {
      "stop_loss": {"type": "fixed_pct", "value": 0.5},
      "take_profit": {"type": "rr", "ratio": 2.0}
    },
    "filters": [
      {"type": "session", "sessions": ["london"]}
    ],
    "commission_pct": 0.07
  },
  "assumptions": [],
  "warnings": [],
  "needs_confirmation": true
}

2) Error:
{
  "error": true,
  "message": "Missing required info: ..."
}

Rules:
- Supported condition types (use ONLY these exact types):
  - {"type": "ema_cross", "fast": N, "slow": N}
  - {"type": "rsi_above", "period": N, "value": N}
  - {"type": "rsi_below", "period": N, "value": N}
  - {"type": "session_range", "session": "asian"|"london"|"new_york"|"sydney"|"tokyo"|"london_ny_overlap"}
  - {"type": "breakout", "level": "session_high"|"session_low"}
- For breakout strategies: ALWAYS include a session_range condition BEFORE the breakout condition
- Example breakout conditions array:
  [
    {"type": "session_range", "session": "asian"},
    {"type": "breakout", "level": "session_high"}
  ]
- NEVER use types like "breakout_high", "breakout_low", "session_breakout", or any other custom type
- Supported session values: london, new_york, asian, tokyo, sydney, london_ny_overlap
- Supported timeframes: 1m, 5m, 15m, 1h, 4h, 1d
- Do not include date_range unless the user explicitly provides it
- If market is missing, return error
- If exit rule is missing, return error
- Use reasonable defaults only for non-critical fields like commission_pct
- The user may write in English, Slovak, Polish, or mixed casual language
- Return ONLY valid JSON
- No markdown
- No explanation`;

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response from parser" }, { status: 500 });
    }

    // Strip markdown fences if Claude adds them despite instructions
    let raw = textBlock.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Parser returned invalid JSON" }, { status: 500 });
    }

    // Error shape from Claude
    if (parsed.error === true && typeof parsed.message === "string") {
      return NextResponse.json({
        error: true,
        message: parsed.message,
      });
    }

    // Success shape — validate minimally
    if (!parsed.dsl || typeof parsed.dsl !== "object") {
      return NextResponse.json({ error: "Parser returned invalid structure" }, { status: 500 });
    }

    // Normalize any malformed condition types
    const dsl = parsed.dsl as Record<string, unknown>;
    const entry = dsl.entry as Record<string, unknown> | undefined;
    if (entry?.conditions && Array.isArray(entry.conditions)) {
      entry.conditions = entry.conditions.flatMap((c: Record<string, unknown>) => {
        if (c.type === "breakout_high" || c.type === "session_breakout_high") {
          return [
            { type: "session_range", session: (c as Record<string, unknown>).session ?? "asian" },
            { type: "breakout", level: "session_high" },
          ];
        }
        if (c.type === "breakout_low" || c.type === "session_breakout_low") {
          return [
            { type: "session_range", session: (c as Record<string, unknown>).session ?? "asian" },
            { type: "breakout", level: "session_low" },
          ];
        }
        if (c.type === "session_breakout") {
          const level = (c as Record<string, unknown>).level;
          return [
            { type: "session_range", session: (c as Record<string, unknown>).session ?? "asian" },
            { type: "breakout", level: level === "session_low" ? "session_low" : "session_high" },
          ];
        }
        return [c];
      });
    }

    return NextResponse.json({
      dsl,
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      needs_confirmation: true,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
