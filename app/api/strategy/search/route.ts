import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { query, filters } = (await req.json()) as { query: string; filters?: string[] };
    if (!query?.trim()) return NextResponse.json({ error: "query required" }, { status: 400 });

    const filterHint = filters?.length ? `\nFilter preferences: ${filters.join(", ")}` : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: `You are a trading strategy research assistant. Given a search query, generate 3-5 realistic, well-known trading strategies that match the query. These should be based on your knowledge of real trading methodologies used by traders worldwide.

Return ONLY a JSON array of objects with these fields:
[{
  "title": "Strategy name",
  "summary": "2-3 sentence description",
  "methodology": "main methodology category",
  "marketFit": ["forex", "gold", etc.],
  "difficulty": "beginner" | "intermediate" | "advanced",
  "rules": ["rule 1", "rule 2", ...up to 6 rules],
  "sourceDescription": "Brief note on origin or popularity"
}]

Be specific and actionable. No generic advice. Return ONLY valid JSON, no markdown fences.`,
        },
        {
          role: "user",
          content: `Search for trading strategies matching: "${query}"${filterHint}`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.6,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    try {
      const results = JSON.parse(raw);
      return NextResponse.json({ results: Array.isArray(results) ? results : [] });
    } catch {
      return NextResponse.json({ results: [] });
    }
  } catch (e) {
    console.error("[strategy-search] error:", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
