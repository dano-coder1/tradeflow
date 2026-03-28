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

export function detectPreviousLevels(times: number[], bars: OhlcBar[]): PreviousLevels {
  if (bars.length === 0 || times.length === 0) return {};

  const lastTime = times[times.length - 1];
  const lastDate = new Date(lastTime * 1000);

  function barsInRange(startSec: number, endSec: number): OhlcBar[] {
    const result: OhlcBar[] = [];
    for (let i = 0; i < times.length; i++) {
      if (times[i] >= startSec && times[i] < endSec) result.push(bars[i]);
    }
    return result;
  }

  function highLow(subset: OhlcBar[]): { high: number; low: number } | null {
    if (subset.length === 0) return null;
    let h = -Infinity;
    let l = Infinity;
    for (const b of subset) {
      if (b.high > h) h = b.high;
      if (b.low < l) l = b.low;
    }
    return { high: h, low: l };
  }

  const levels: PreviousLevels = {};

  // PDH/PDL
  const todayStart = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate()));
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const pdhl = highLow(barsInRange(yesterdayStart.getTime() / 1000, todayStart.getTime() / 1000));
  if (pdhl) { levels.pdh = pdhl.high; levels.pdl = pdhl.low; }

  // PWH/PWL
  const dayOfWeek = lastDate.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisWeekStart = new Date(todayStart.getTime() - mondayOffset * 86_400_000);
  const prevWeekStart = new Date(thisWeekStart.getTime() - 7 * 86_400_000);
  const pwhl = highLow(barsInRange(prevWeekStart.getTime() / 1000, thisWeekStart.getTime() / 1000));
  if (pwhl) { levels.pwh = pwhl.high; levels.pwl = pwhl.low; }

  // PMH/PML
  const thisMonthStart = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), 1));
  const prevMonthStart = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth() - 1, 1));
  const pmhl = highLow(barsInRange(prevMonthStart.getTime() / 1000, thisMonthStart.getTime() / 1000));
  if (pmhl) { levels.pmh = pmhl.high; levels.pml = pmhl.low; }

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
