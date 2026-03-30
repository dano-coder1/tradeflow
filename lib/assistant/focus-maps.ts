export interface FocusStep {
  title: string;
  step: string;
  rule: string;
}

const FOCUS_SEQUENCES: Record<string, FocusStep[]> = {
  overtrading: [
    { title: "Control overtrading", step: "Do not open a trade without a clear setup on your checklist.", rule: "If no setup \u2192 no trade" },
    { title: "Wait for confirmation", step: "Before every entry, confirm at least 2 confluences from your playbook.", rule: "No confirmation \u2192 no entry" },
    { title: "Limit your trades", step: "Set a maximum of 2 trades per session today. Stop after that.", rule: "Max 2 trades per session" },
    { title: "No revenge trading", step: "After a loss, close your charts for 15 minutes before looking again.", rule: "Loss \u2192 pause \u2192 then decide" },
  ],
  emotions: [
    { title: "Identify your trigger", step: "Write down the last time you traded emotionally. What triggered it?", rule: "Name the emotion before you act on it" },
    { title: "Pause after reaction", step: "When you feel the urge to enter impulsively, set a 10-minute timer first.", rule: "Urge \u2192 timer \u2192 then decide" },
    { title: "Breathe before entry", step: "Before clicking buy or sell, take 3 slow breaths and re-read your rules.", rule: "3 breaths before every trade" },
    { title: "Journal the feeling", step: "After each trade, write one sentence about how you felt during entry.", rule: "Every trade gets an emotion note" },
  ],
  late_entries: [
    { title: "Mark key levels first", step: "Before the session, mark 3 key levels on your chart. Do not trade until price reaches one.", rule: "No levels marked \u2192 no trading" },
    { title: "Set alerts", step: "Place price alerts at your marked levels. Do not watch the chart constantly.", rule: "Alert triggers \u2192 then you look" },
    { title: "Wait for retest", step: "When price breaks a level, do not chase. Wait for the retest.", rule: "No retest \u2192 no entry" },
    { title: "No chasing candles", step: "If you missed the move, accept it. There will always be another setup.", rule: "Missed \u2192 move on" },
  ],
  no_strategy: [
    { title: "Write one rule today", step: "Open a note and write one concrete entry rule. Just one.", rule: "One rule is better than zero" },
    { title: "Backtest on paper", step: "Look back at 10 recent candles. Would your rule have worked? Write the result.", rule: "Test before you trust" },
    { title: "Define entry criteria", step: "Write exactly what must happen before you click buy or sell.", rule: "If criteria not met \u2192 no trade" },
    { title: "Define exit criteria", step: "Write your TP and SL rules. Where do you get out?", rule: "Every entry needs an exit plan" },
  ],
  no_review: [
    { title: "Review your last trade", step: "Open your last closed trade. Read the entry, exit, and result.", rule: "No new trade without reviewing the last one" },
    { title: "Write what went wrong", step: "For your last losing trade, write one thing you could have done differently.", rule: "Every loss teaches something" },
    { title: "Write what went right", step: "For your last winning trade, write what you did well and should repeat.", rule: "Repeat what works" },
    { title: "Set a review schedule", step: "Pick a time each day to review trades. Set a reminder.", rule: "Review is not optional" },
  ],
};

const DEFAULT_SEQUENCE: FocusStep[] = [
  { title: "Stay focused today", step: "Follow your trading plan. One setup, one execution.", rule: "Plan the trade, trade the plan" },
  { title: "Review before you trade", step: "Look at yesterday\u2019s trades before opening anything new.", rule: "Learn from yesterday" },
  { title: "Respect your stop loss", step: "Set your SL before entry and do not move it.", rule: "SL is non-negotiable" },
  { title: "End the day with a note", step: "Write one sentence about what you learned today.", rule: "Growth requires reflection" },
];

export function getFocusSequence(biggestProblem: string): FocusStep[] {
  return FOCUS_SEQUENCES[biggestProblem] ?? DEFAULT_SEQUENCE;
}

export function getFocusStep(biggestProblem: string, index: number): FocusStep {
  const seq = getFocusSequence(biggestProblem);
  return seq[Math.min(index, seq.length - 1)];
}

export function getTotalSteps(biggestProblem: string): number {
  return getFocusSequence(biggestProblem).length;
}
