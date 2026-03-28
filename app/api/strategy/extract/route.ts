import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a trading strategy analyst. Extract a clear, structured trading strategy from the provided content.

Return ONLY valid JSON matching this schema:
{
  "summary": "2-3 sentence strategy summary",
  "rules": ["specific actionable rule 1", "rule 2", ...max 12],
  "methodologyTags": ["smc", "price-action", "breakout", etc.],
  "marketTags": ["forex", "gold", "indices", "crypto", "futures"],
  "difficulty": "beginner" | "intermediate" | "advanced",
  "riskManagement": "brief risk management approach",
  "timeframeHint": "suggested timeframes like 1H, 4H, Daily"
}

Rules must be specific and actionable. No generic advice.
Return ONLY valid JSON, no markdown fences.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, url, files } = body as {
      text?: string;
      url?: string;
      files?: { name: string; data: string }[];
    };

    let content = "";

    if (text?.trim()) content = text.trim();

    if (url?.trim()) {
      try {
        const res = await fetch(url.trim(), {
          headers: { "User-Agent": "Mozilla/5.0 TradeFlow Bot" },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const html = await res.text();
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

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (files && files.length > 0) {
      const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
      if (content) parts.push({ type: "text", text: `Strategy description:\n${content}` });
      for (const file of files) {
        const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        if (isImage && file.data) {
          parts.push({ type: "image_url", image_url: { url: file.data } });
        } else if (file.data) {
          parts.push({ type: "text", text: `[File: ${file.name}]\n${file.data.slice(0, 5000)}` });
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
        methodologyTags: Array.isArray(parsed.methodologyTags) ? parsed.methodologyTags : [],
        marketTags: Array.isArray(parsed.marketTags) ? parsed.marketTags : [],
        difficulty: parsed.difficulty ?? "intermediate",
        riskManagement: parsed.riskManagement ?? "",
        timeframeHint: parsed.timeframeHint ?? "",
      });
    } catch {
      return NextResponse.json({
        summary: raw.slice(0, 200),
        rules: [raw],
        methodologyTags: [],
        marketTags: [],
        difficulty: "intermediate",
      });
    }
  } catch (e) {
    console.error("[strategy-extract] error:", e);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
