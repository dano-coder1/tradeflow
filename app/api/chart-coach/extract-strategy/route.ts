import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EXTRACTION_PROMPT = `You are a trading strategy analyst. Extract a clear, structured trading strategy from the content provided.

Return a JSON object with exactly these fields:
{
  "summary": "2-3 sentence summary of the strategy",
  "rules": ["rule 1", "rule 2", ...],
  "methodology": "one of: SMC, Price Action, Indicators, Trend Following, Scalping, Swing Trading, Mixed"
}

Rules should be specific and actionable (e.g. "Enter long on bullish order block after BOS", not "Look for entries").
Extract 5-15 rules maximum. Be concise.
Return ONLY valid JSON, no markdown fences.`;

const SMC_PRESET = {
  summary: "Smart Money Concepts (SMC) strategy focused on institutional order flow. Identifies structure breaks, order blocks, and fair value gaps to find high-probability entries aligned with smart money positioning.",
  rules: [
    "Identify market structure: higher highs/lows for bullish, lower highs/lows for bearish",
    "Wait for BOS (Break of Structure) to confirm trend direction",
    "CHoCH (Change of Character) signals potential trend reversal — proceed with caution",
    "Enter on bullish order blocks after bullish BOS, bearish order blocks after bearish BOS",
    "Use FVG (Fair Value Gap) as entry zones when price retraces into the imbalance",
    "Check PDH/PDL for liquidity sweep before entering",
    "Trade in discount zone for longs, premium zone for shorts",
    "Require at least 2 confluences before entering (e.g. OB + FVG + structure)",
    "Stop loss below/above the order block used for entry",
    "TP1 at nearest opposing liquidity level, TP2 at next structure point",
    "Avoid trading mid-range — wait for price to reach premium or discount",
    "Higher timeframe bias must align with entry timeframe direction",
  ],
  methodology: "SMC",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, url, files, smc } = body as {
      text?: string;
      url?: string;
      files?: { name: string; data: string }[];
      smc?: boolean;
    };

    // SMC preset — no AI needed
    if (smc) {
      return NextResponse.json(SMC_PRESET);
    }

    // Build content for extraction
    let content = "";

    if (text?.trim()) {
      content = text.trim();
    }

    if (url?.trim()) {
      try {
        const res = await fetch(url.trim(), {
          headers: { "User-Agent": "Mozilla/5.0 TradeFlow Bot" },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const html = await res.text();
          // Strip HTML tags, keep text content (basic extraction)
          const stripped = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 8000);
          content += `\n\nContent from URL (${url}):\n${stripped}`;
        } else {
          content += `\n\n[Could not fetch URL: ${url} — status ${res.status}]`;
        }
      } catch {
        content += `\n\n[Could not fetch URL: ${url}]`;
      }
    }

    if (!content && (!files || files.length === 0)) {
      return NextResponse.json({ error: "No strategy content provided" }, { status: 400 });
    }

    // Build messages
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: EXTRACTION_PROMPT },
    ];

    if (files && files.length > 0) {
      // Use vision for image files, text content for others
      const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
      if (content) parts.push({ type: "text", text: `Strategy description:\n${content}` });

      for (const file of files) {
        const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        if (isImage && file.data) {
          parts.push({ type: "image_url", image_url: { url: file.data } });
        } else if (file.data) {
          // For PDFs, we send as text description since we can't parse PDF on client
          parts.push({ type: "text", text: `[Uploaded file: ${file.name}]\n${file.data.slice(0, 5000)}` });
        }
      }

      if (parts.length === 0) parts.push({ type: "text", text: "Extract a trading strategy from these files." });
      messages.push({ role: "user", content: parts });
    } else {
      messages.push({ role: "user", content: `Extract a trading strategy from this:\n\n${content}` });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages,
      max_tokens: 1000,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    try {
      const parsed = JSON.parse(raw);
      return NextResponse.json({
        summary: parsed.summary ?? "Strategy extracted.",
        rules: Array.isArray(parsed.rules) ? parsed.rules : [],
        methodology: parsed.methodology ?? "Mixed",
      });
    } catch {
      // If AI didn't return valid JSON, wrap the response
      return NextResponse.json({
        summary: raw.slice(0, 200),
        rules: [raw],
        methodology: "Mixed",
      });
    }
  } catch (e) {
    console.error("[extract-strategy] error:", e);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
