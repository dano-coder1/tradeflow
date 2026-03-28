// ── Smart Money Concepts (SMC) Engine ────────────────────────────────────────
// Pure calculation functions — no chart library dependency.

export interface OhlcBar {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface SwingPoint {
  index: number;
  price: number;
  type: "high" | "low";
}

export interface StructureBreak {
  fromIndex: number;
  toIndex: number;
  price: number;
  type: "bos" | "choch";
  direction: "bullish" | "bearish";
}

export interface OrderBlock {
  index: number;
  high: number;
  low: number;
  endIndex: number;
  direction: "bullish" | "bearish";
}

export interface FairValueGap {
  index: number;
  high: number;
  low: number;
  direction: "bullish" | "bearish";
}

export interface PreviousLevels {
  pdh?: number;
  pdl?: number;
  pwh?: number;
  pwl?: number;
  pmh?: number;
  pml?: number;
}

export interface PremiumDiscountRange {
  high: number;
  low: number;
  eq: number;
}

export interface SmcResult {
  swings: SwingPoint[];
  structures: StructureBreak[];
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  previousLevels: PreviousLevels;
  premiumDiscount: PremiumDiscountRange | null;
}

export interface SmcConfig {
  lookback: number;
  obBoxMode: "highlow" | "body";
}

// ── Swing detection ──────────────────────────────────────────────────────────

export function detectSwings(bars: OhlcBar[], lookback: number = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isHigh = false;
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isLow = false;
    }
    if (isHigh) swings.push({ index: i, price: bars[i].high, type: "high" });
    if (isLow) swings.push({ index: i, price: bars[i].low, type: "low" });
  }
  return swings;
}

// ── BOS / CHoCH detection with trend tracking ────────────────────────────────

export function detectStructure(
  bars: OhlcBar[],
  swings: SwingPoint[],
): StructureBreak[] {
  const breaks: StructureBreak[] = [];
  if (swings.length < 2) return breaks;

  let trend: "bullish" | "bearish" | null = null;
  let lastSwingHigh: SwingPoint | null = null;
  let lastSwingLow: SwingPoint | null = null;

  for (const sw of swings) {
    if (sw.type === "high") {
      lastSwingHigh = sw;
    } else {
      lastSwingLow = sw;
    }

    if (!lastSwingHigh || !lastSwingLow) continue;

    const nextSwingIdx = swings.indexOf(sw) + 1;
    const scanEnd = nextSwingIdx < swings.length ? swings[nextSwingIdx].index : bars.length;

    for (let i = sw.index + 1; i < scanEnd && i < bars.length; i++) {
      if (lastSwingHigh && bars[i].close > lastSwingHigh.price) {
        const isTrendFlip = trend === "bearish";
        breaks.push({
          fromIndex: lastSwingHigh.index,
          toIndex: i,
          price: lastSwingHigh.price,
          type: isTrendFlip ? "choch" : "bos",
          direction: "bullish",
        });
        trend = "bullish";
        lastSwingHigh = null;
        break;
      }
      if (lastSwingLow && bars[i].close < lastSwingLow.price) {
        const isTrendFlip = trend === "bullish";
        breaks.push({
          fromIndex: lastSwingLow.index,
          toIndex: i,
          price: lastSwingLow.price,
          type: isTrendFlip ? "choch" : "bos",
          direction: "bearish",
        });
        trend = "bearish";
        lastSwingLow = null;
        break;
      }
    }
  }

  return breaks;
}

// ── Order Blocks ─────────────────────────────────────────────────────────────

export function detectOrderBlocks(
  bars: OhlcBar[],
  structures: StructureBreak[],
  boxMode: "highlow" | "body" = "body",
): OrderBlock[] {
  const obs: OrderBlock[] = [];

  for (const brk of structures) {
    if (brk.type !== "bos") continue;

    if (brk.direction === "bullish") {
      for (let i = brk.toIndex - 1; i >= Math.max(0, brk.toIndex - 10); i--) {
        if (bars[i].close < bars[i].open) {
          obs.push({
            index: i,
            high: boxMode === "highlow" ? bars[i].high : Math.max(bars[i].open, bars[i].close),
            low: boxMode === "highlow" ? bars[i].low : Math.min(bars[i].open, bars[i].close),
            endIndex: Math.min(i + 20, bars.length - 1),
            direction: "bullish",
          });
          break;
        }
      }
    } else {
      for (let i = brk.toIndex - 1; i >= Math.max(0, brk.toIndex - 10); i--) {
        if (bars[i].close > bars[i].open) {
          obs.push({
            index: i,
            high: boxMode === "highlow" ? bars[i].high : Math.max(bars[i].open, bars[i].close),
            low: boxMode === "highlow" ? bars[i].low : Math.min(bars[i].open, bars[i].close),
            endIndex: Math.min(i + 20, bars.length - 1),
            direction: "bearish",
          });
          break;
        }
      }
    }
  }

  return obs;
}

// ── Fair Value Gaps ──────────────────────────────────────────────────────────

export function detectFVGs(bars: OhlcBar[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  for (let i = 2; i < bars.length; i++) {
    const prev = bars[i - 2];
    const curr = bars[i];

    if (prev.high < curr.low) {
      fvgs.push({ index: i - 1, high: curr.low, low: prev.high, direction: "bullish" });
    }
    if (prev.low > curr.high) {
      fvgs.push({ index: i - 1, high: prev.low, low: curr.high, direction: "bearish" });
    }
  }
  return fvgs;
}

// ── Previous period levels ───────────────────────────────────────────────────
// Groups candles by UTC day/week/month from the actual timestamps rather than
// assuming calendar boundaries exist in the dataset. This handles short
// timeframes (1m, 5m) where only a few hours of data are loaded.

function utcDayKey(sec: number): string {
  const d = new Date(sec * 1000);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function utcWeekKey(sec: number): string {
  // ISO week: Monday-based. Compute the Monday of the week.
  const d = new Date(sec * 1000);
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const monday = new Date(d.getTime() - mondayOffset * 86_400_000);
  return `${monday.getUTCFullYear()}-W${monday.getUTCMonth()}-${monday.getUTCDate()}`;
}

function utcMonthKey(sec: number): string {
  const d = new Date(sec * 1000);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

interface GroupedHL {
  high: number;
  low: number;
}

function groupHighLow(
  times: number[],
  bars: OhlcBar[],
  keyFn: (sec: number) => string,
): Map<string, GroupedHL> {
  const groups = new Map<string, GroupedHL>();
  for (let i = 0; i < times.length; i++) {
    const k = keyFn(times[i]);
    const existing = groups.get(k);
    if (existing) {
      if (bars[i].high > existing.high) existing.high = bars[i].high;
      if (bars[i].low < existing.low) existing.low = bars[i].low;
    } else {
      groups.set(k, { high: bars[i].high, low: bars[i].low });
    }
  }
  return groups;
}

function previousGroupHL(
  times: number[],
  bars: OhlcBar[],
  keyFn: (sec: number) => string,
): GroupedHL | null {
  const groups = groupHighLow(times, bars, keyFn);
  // Keys are insertion-ordered; the last key is the current period.
  // We want the second-to-last (the previous completed period).
  const keys = Array.from(groups.keys());
  if (keys.length < 2) return null; // not enough periods
  return groups.get(keys[keys.length - 2]) ?? null;
}

export function detectPreviousLevels(times: number[], bars: OhlcBar[]): PreviousLevels {
  if (bars.length === 0 || times.length === 0) return {};

  const levels: PreviousLevels = {};

  // PDH/PDL — previous UTC day
  const prevDay = previousGroupHL(times, bars, utcDayKey);
  if (prevDay) {
    levels.pdh = prevDay.high;
    levels.pdl = prevDay.low;
  }

  // PWH/PWL — previous UTC week
  const prevWeek = previousGroupHL(times, bars, utcWeekKey);
  if (prevWeek) {
    levels.pwh = prevWeek.high;
    levels.pwl = prevWeek.low;
  }

  // PMH/PML — previous UTC month
  const prevMonth = previousGroupHL(times, bars, utcMonthKey);
  if (prevMonth) {
    levels.pmh = prevMonth.high;
    levels.pml = prevMonth.low;
  }

  console.log("[SMC] detectPreviousLevels →", {
    totalBars: bars.length,
    firstTime: new Date(times[0] * 1000).toISOString(),
    lastTime: new Date(times[times.length - 1] * 1000).toISOString(),
    levels,
  });

  return levels;
}

// ── Premium / Discount zone ─────────────────────────────────────────────────

export function calcPremiumDiscount(swings: SwingPoint[]): PremiumDiscountRange | null {
  if (swings.length < 2) return null;
  let lastHigh: SwingPoint | null = null;
  let lastLow: SwingPoint | null = null;
  for (let i = swings.length - 1; i >= 0; i--) {
    if (swings[i].type === "high" && !lastHigh) lastHigh = swings[i];
    if (swings[i].type === "low" && !lastLow) lastLow = swings[i];
    if (lastHigh && lastLow) break;
  }
  if (!lastHigh || !lastLow) return null;
  const high = lastHigh.price;
  const low = lastLow.price;
  if (high <= low) return null;
  return { high, low, eq: (high + low) / 2 };
}

// ── Main entry point ─────────────────────────────────────────────────────────

export function runSmcAnalysis(
  bars: OhlcBar[],
  times: number[] = [],
  config: SmcConfig = { lookback: 3, obBoxMode: "body" },
): SmcResult {
  const swings = detectSwings(bars, config.lookback);
  const structures = detectStructure(bars, swings);
  const orderBlocks = detectOrderBlocks(bars, structures, config.obBoxMode);
  const fvgs = detectFVGs(bars);
  const previousLevels = times.length > 0 ? detectPreviousLevels(times, bars) : {};
  const premiumDiscount = calcPremiumDiscount(swings);
  return { swings, structures, orderBlocks, fvgs, previousLevels, premiumDiscount };
}
