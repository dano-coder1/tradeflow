/**
 * Personalized response engine for the Assistant quick actions.
 * Generates hardcoded responses based on user profile — no AI API needed.
 */

import type { AssistantProfile } from "@/types/assistant";

export interface AssistantResponse {
  message: string;
  followUps: string[];
}

type ActionKey = "next_step" | "build_strategy" | "review_mistake" | "market_structure" | "simplify_setup"
  | "why_overtrade" | "focus_today" | "explain_structure" | "avoid_bad_entries"
  | "show_example" | "make_simpler" | "what_avoid" | "give_rule" | "break_down";

// ── Tone wrappers ────────────────────────────────────────────────────────────

function tone(mode: string, direct: string, gentle: string, mentor: string): string {
  if (mode === "discipline_coach" || mode === "execution_coach") return direct;
  if (mode === "beginner_coach") return gentle;
  return mentor;
}

// ── Response generators ──────────────────────────────────────────────────────

const GENERATORS: Record<ActionKey, (p: AssistantProfile) => AssistantResponse> = {
  next_step: (p) => {
    const m = p.assistant_mode;
    const focus = p.focus_area?.replace(/_/g, " ") ?? "your trading";

    return {
      message: tone(m,
        `Your next step is simple: focus on ${focus}. Don't get distracted by other setups. Open your chart, mark one key level, and wait. If no setup forms — close the chart. That's discipline.`,
        `Let's take it one step at a time. Right now, your focus is ${focus}. Before you do anything else, I want you to just observe the chart for 5 minutes. Notice where price is relative to structure. Don't trade yet — just look.`,
        `Based on your profile, your priority is ${focus}. Here's what I'd suggest: spend your first 15 minutes today identifying the bias on a higher timeframe. Only after that, move to your entry timeframe. This sequence builds consistency.`,
      ),
      followUps: ["Give me a rule", "Break this down", "What should I avoid?"],
    };
  },

  build_strategy: (p) => {
    const level = p.experience_level;
    return {
      message: tone(p.assistant_mode,
        `Stop collecting strategies. Pick ONE setup and master it. Here's the framework: define your bias (HTF), define your trigger (LTF), define your SL/TP rules. Write it down. If you can't explain it in 3 sentences, it's too complex.`,
        level === "beginner"
          ? `Building a strategy doesn't need to be complicated. Start with this: (1) What direction is the market going? (2) Where do I want to enter? (3) Where do I exit if wrong? That's it. We'll refine later.`
          : `Let's build on what you already know. A solid strategy has 3 layers: bias (what the market wants to do), entry (when to get in), and management (how to protect yourself). Which layer do you want to work on first?`,
        `A strategy is a system of rules, not a feeling. Start with your edge — what specific pattern do you recognize consistently? Once you name it, we can build entry, invalidation, and target rules around it. That becomes your playbook.`,
      ),
      followUps: ["Show me an example", "Make it simpler", "Give me a rule"],
    };
  },

  review_mistake: (p) => {
    const problem = p.biggest_problem?.replace(/_/g, " ") ?? "mistakes";
    return {
      message: tone(p.assistant_mode,
        `Let's be real about your ${problem}. Pull up your last losing trade. Answer three questions: (1) Did I follow my rules? (2) Was the setup valid? (3) Would I take this trade again? If any answer is no — there's your lesson. Write it down.`,
        `Reviewing mistakes is the fastest way to improve. Don't be hard on yourself — every trader makes mistakes. Let's look at your last trade: what was your entry reason? Was it planned or impulsive? Understanding this is more important than the P&L.`,
        `The mistake isn't the loss — it's not learning from it. Open your last trade and ask: was this my setup, or was I improvising? If you were improvising, the fix isn't a better entry — it's better preparation. Your playbook should prevent this.`,
      ),
      followUps: ["What should I avoid?", "Give me a rule", "Break this down"],
    };
  },

  market_structure: (p) => ({
    message: tone(p.assistant_mode,
      `Market structure is simple: higher highs + higher lows = bullish. Lower highs + lower lows = bearish. When structure breaks (CHoCH), the bias flips. That's it. Everything else — OBs, FVGs, liquidity — is built on top of this. Master structure first.`,
      `Market structure is like reading a map. Price moves in waves — up and down. When the "up waves" keep getting higher, the market is bullish. When the "down waves" keep getting lower, it's bearish. The key moment is when this pattern breaks — that's called a Change of Character (CHoCH). Start by just identifying these on any chart.`,
      `Structure is the backbone of price action. At its core: trend continuation = structure holds (higher highs/lows or lower highs/lows). Reversal = structure breaks (CHoCH). Your job is to identify which phase you're in BEFORE looking for entries. Don't trade against structure unless you have a clear CHoCH.`,
    ),
    followUps: ["Show me an example", "Make it simpler", "Break this down"],
  }),

  simplify_setup: (p) => ({
    message: tone(p.assistant_mode,
      `If your setup needs more than 5 rules to enter, it's too complex. Strip it back: (1) What's the bias? (2) Where's the zone? (3) What confirms the entry? Three things. If all three align — trade. If not — wait. Complexity kills execution.`,
      `Let's make this really simple. A good setup answers three questions: Is the market going up or down? Where should I enter? Where do I put my stop loss? If you can answer those clearly, you have a tradeable setup. We can add more later.`,
      `Simplification is optimization. The best traders I've studied use 3-5 confluences max. Here's a universal framework: (1) HTF bias alignment, (2) POI reached (OB/FVG/S&R), (3) LTF confirmation. If you're adding more conditions, you're likely over-filtering.`,
    ),
    followUps: ["Give me a rule", "Show me an example", "What should I avoid?"],
  }),

  // Chat prompts
  why_overtrade: (p) => ({
    message: tone(p.assistant_mode,
      `You overtrade because you're afraid of missing out. Every candle feels like a potential trade. The fix isn't more willpower — it's a clear checklist. If the checklist isn't complete, you physically cannot enter. Rules replace emotions.`,
      `Overtrading usually comes from one of these: boredom, fear of missing moves, or trying to recover losses. The first step is recognizing WHICH one drives you. Once you know your trigger, we can build a system to manage it.`,
      `Overtrading is a symptom, not the root cause. It typically stems from: no clear criteria for valid setups, emotional attachment to being "in the market", or inadequate patience training. The solution is a pre-trade checklist that forces a pause between impulse and action.`,
    ),
    followUps: ["Give me a rule", "What should I avoid?", "Break this down"],
  }),

  focus_today: (p) => {
    const focus = p.focus_area?.replace(/_/g, " ") ?? "your trading plan";
    return {
      message: tone(p.assistant_mode,
        `Today's priority: ${focus}. Everything else is noise. Mark your levels before the session, define your risk, and only trade if your checklist is complete. No checklist, no trade.`,
        `Today, I'd like you to focus on just one thing: ${focus}. Don't try to do everything at once. Open your chart, observe for 10 minutes, and only then decide if there's a setup worth taking. Quality over quantity.`,
        `Your focus today should be ${focus}. I'd suggest starting with a top-down analysis: weekly bias first, then daily structure, then your entry timeframe. Document what you see before you trade. This pre-session routine is where consistency is built.`,
      ),
      followUps: ["Give me a rule", "Break this down", "What should I avoid?"],
    };
  },

  explain_structure: (p) => ({
    message: tone(p.assistant_mode,
      `Structure = the skeleton of price. Highs and lows tell you everything. Bullish: HH + HL. Bearish: LH + LL. When a key low breaks in an uptrend (or key high in a downtrend), structure shifts. That's your signal. Don't overthink it.`,
      `Think of market structure like stairs. In an uptrend, price makes steps UP — each step higher than the last. In a downtrend, steps go DOWN. When the stairs suddenly go the other way, that's a potential reversal. Your job is to identify the direction of the stairs BEFORE entering a trade.`,
      `Market structure operates on a fractal basis — what you see on the daily exists on the 1H, and on the 5M. The key is identifying which timeframe's structure matters for YOUR trades. Generally: bias from HTF (Daily/4H), entries from LTF (15M/5M). A Break of Structure (BOS) continues trend; a Change of Character (CHoCH) signals reversal.`,
    ),
    followUps: ["Show me an example", "Make it simpler", "Give me a rule"],
  }),

  avoid_bad_entries: (p) => ({
    message: tone(p.assistant_mode,
      `Bad entries have three signatures: (1) No plan before the candle. (2) Entering on emotion. (3) No SL defined. If ANY of these apply, you don't have an entry — you have a gamble. Fix this with a mandatory 30-second pause before every order.`,
      `A bad entry usually happens when you feel rushed or excited. Here's a simple test before any trade: "Can I explain why I'm entering in one sentence?" If you can't, wait. There will always be another setup.`,
      `Most bad entries come from three sources: chasing (entering after the move), revenge (entering to recover), and FOMO (entering because it "looks like" a setup). The antidote to all three is the same: a written plan created BEFORE the session starts. If the trade isn't on your plan, it doesn't exist.`,
    ),
    followUps: ["Give me a rule", "Break this down", "What should I avoid?"],
  }),

  // Follow-up responses
  show_example: () => ({
    message: `Here's a simple example: Say EURUSD is in a downtrend on H4 (lower highs, lower lows). Price pulls back into a supply zone (order block) on the H1. On M15, you see a bearish engulfing candle with a Break of Structure down. That's your entry. SL above the OB, TP at the previous low. Simple, structured, repeatable.`,
    followUps: ["Make it simpler", "Give me a rule"],
  }),

  make_simpler: () => ({
    message: `At its simplest: (1) Which way is the market going? UP or DOWN. (2) Wait for price to come back to a key zone. (3) When you see rejection at that zone, enter. That's the core of every setup. Everything else is refinement.`,
    followUps: ["Show me an example", "Give me a rule"],
  }),

  what_avoid: (p) => ({
    message: tone(p.assistant_mode,
      `Avoid these at all costs: trading without a stop loss, entering during news without a plan, adding to losing positions, and trading when angry or tired. If you do any of these, you're not trading — you're gambling.`,
      `The biggest things to avoid as you learn: don't trade every pair (pick 2-3), don't trade every session (pick one), and don't trade without marking your levels first. Less is more when you're building good habits.`,
      `Avoid these consistently: over-leveraging, trading outside your session window, ignoring HTF bias, and breaking your own rules "just this once." The last one is the most dangerous — it's how bad habits form.`,
    ),
    followUps: ["Give me a rule", "Break this down"],
  }),

  give_rule: (p) => {
    const rules: Record<string, string> = {
      overtrading: "Rule: Maximum 2 trades per session. After 2, close the platform. No exceptions.",
      emotions: "Rule: After any loss, wait 10 minutes before looking at charts. Set a physical timer.",
      late_entries: "Rule: If the candle has already moved more than 50% of your expected range, the entry is invalid. Wait for the next setup.",
      no_strategy: "Rule: Before every trade, write down your entry reason in one sentence. If you can't — don't trade.",
      no_review: "Rule: No new trade until you've reviewed and noted one lesson from your last closed trade.",
    };
    const rule = rules[p.biggest_problem] ?? "Rule: Plan the trade, trade the plan. No plan = no trade.";
    return { message: rule, followUps: ["Break this down", "Show me an example"] };
  },

  break_down: () => ({
    message: `Let me break it down into steps:\n\n1. **Before the session**: Mark your HTF bias and key levels.\n2. **During the session**: Watch for price to reach your zones. Do NOT trade in between.\n3. **At the zone**: Wait for LTF confirmation (BOS, engulfing, displacement).\n4. **Entry**: Place order with SL and TP already defined.\n5. **After the trade**: Log it. Review it. Move on.\n\nEach step has ONE job. Don't skip ahead.`,
    followUps: ["Give me a rule", "Make it simpler"],
  }),
};

// ── Public API ───────────────────────────────────────────────────────────────

export function getResponse(actionKey: ActionKey, profile: AssistantProfile): AssistantResponse {
  const generator = GENERATORS[actionKey];
  if (!generator) return { message: "I'm not sure how to help with that yet.", followUps: [] };
  return generator(profile);
}

export type { ActionKey };
