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
  fromIndex: number; // the swing that set the level
  toIndex: number;   // the bar that broke it
  price: number;     // the broken level
  type: "bos" | "choch";
  direction: "bullish" | "bearish";
}

export interface OrderBlock {
  index: number;     // the OB candle
  high: number;      // max(open, close) of OB candle
  low: number;       // min(open, close) of OB candle
  endIndex: number;  // visual extent
  direction: "bullish" | "bearish";
}

export interface FairValueGap {
  index: number;     // middle candle of the 3-bar pattern
  high: number;      // top edge of gap
  low: number;       // bottom edge of gap
  direction: "bullish" | "bearish";
}

export interface SmcResult {
  swings: SwingPoint[];
  structures: StructureBreak[];
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
}

// ── Swing detection ──────────────────────────────────────────────────────────

const LOOKBACK = 3;

export function detectSwings(bars: OhlcBar[]): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = LOOKBACK; i < bars.length - LOOKBACK; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= LOOKBACK; j++) {
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

  // Seed with first two swings
  for (const sw of swings) {
    if (sw.type === "high" && (!lastSwingHigh || sw.price > lastSwingHigh.price)) {
      lastSwingHigh = sw;
    }
    if (sw.type === "low" && (!lastSwingLow || sw.price < lastSwingLow.price)) {
      lastSwingLow = sw;
    }
  }

  // Reset for sequential scan
  lastSwingHigh = null;
  lastSwingLow = null;

  for (const sw of swings) {
    if (sw.type === "high") {
      lastSwingHigh = sw;
    } else {
      lastSwingLow = sw;
    }

    // Check bars after this swing for breaks
    if (!lastSwingHigh || !lastSwingLow) continue;

    // Look ahead for breaks of this swing's level
    const nextSwingIdx = swings.indexOf(sw) + 1;
    const scanEnd = nextSwingIdx < swings.length ? swings[nextSwingIdx].index : bars.length;

    for (let i = sw.index + 1; i < scanEnd && i < bars.length; i++) {
      // Bullish break: close above last swing high
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
        lastSwingHigh = null; // consumed
        break;
      }
      // Bearish break: close below last swing low
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
        lastSwingLow = null; // consumed
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
): OrderBlock[] {
  const obs: OrderBlock[] = [];

  for (const brk of structures) {
    if (brk.type !== "bos") continue; // only form OBs at confirmed BOS

    if (brk.direction === "bullish") {
      // Bullish OB = last bearish candle before the bullish BOS
      for (let i = brk.toIndex - 1; i >= Math.max(0, brk.toIndex - 10); i--) {
        if (bars[i].close < bars[i].open) {
          obs.push({
            index: i,
            high: Math.max(bars[i].open, bars[i].close),
            low: Math.min(bars[i].open, bars[i].close),
            endIndex: Math.min(i + 20, bars.length - 1),
            direction: "bullish",
          });
          break;
        }
      }
    } else {
      // Bearish OB = last bullish candle before the bearish BOS
      for (let i = brk.toIndex - 1; i >= Math.max(0, brk.toIndex - 10); i--) {
        if (bars[i].close > bars[i].open) {
          obs.push({
            index: i,
            high: Math.max(bars[i].open, bars[i].close),
            low: Math.min(bars[i].open, bars[i].close),
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

    // Bullish FVG: gap up — prev candle high < current candle low
    if (prev.high < curr.low) {
      fvgs.push({
        index: i - 1, // middle candle
        high: curr.low,
        low: prev.high,
        direction: "bullish",
      });
    }
    // Bearish FVG: gap down — prev candle low > current candle high
    if (prev.low > curr.high) {
      fvgs.push({
        index: i - 1,
        high: prev.low,
        low: curr.high,
        direction: "bearish",
      });
    }
  }
  return fvgs;
}

// ── Main entry point ─────────────────────────────────────────────────────────

export function runSmcAnalysis(bars: OhlcBar[]): SmcResult {
  const swings = detectSwings(bars);
  const structures = detectStructure(bars, swings);
  const orderBlocks = detectOrderBlocks(bars, structures);
  const fvgs = detectFVGs(bars);
  return { swings, structures, orderBlocks, fvgs };
}
