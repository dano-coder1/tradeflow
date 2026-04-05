/**
 * Claude API integration for assistant coaching responses.
 * Enforces JSON output with strict schema validation.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface AICoachingResponse {
  insight: string;
  mistake: string;
  action: string;
  priority: "low" | "medium" | "high";
}

const client = new Anthropic();

export async function getAIResponse(prompt: string): Promise<AICoachingResponse> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude API");
  }

  const parsed = JSON.parse(textBlock.text) as Record<string, unknown>;

  // Validate required fields
  if (
    typeof parsed.insight !== "string" ||
    typeof parsed.mistake !== "string" ||
    typeof parsed.action !== "string" ||
    !["low", "medium", "high"].includes(parsed.priority as string)
  ) {
    throw new Error("Invalid response schema from Claude API");
  }

  return parsed as unknown as AICoachingResponse;
}
