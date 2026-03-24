import { z } from "zod";

export const tradeFormSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  direction: z.enum(["long", "short"]),
  entry: z.string().optional(),
  exit: z.string().optional(),
  sl: z.string().optional(),
  tp: z.string().optional(),
  size: z.string().optional(),
  riskAmount: z.string().optional(),
  timeframe: z.string().optional(),
  tag: z.string().optional(),
  notes: z.string().optional(),
  screenshotUrl: z.string().optional(),
});

export type TradeFormValues = z.infer<typeof tradeFormSchema>;

export function parseNum(s: string | undefined | null): number | null {
  if (!s || s.trim() === "") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
