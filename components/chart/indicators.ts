// ── Technical indicator calculations ─────────────────────────────────────────
// All functions operate on plain number arrays extracted from OHLC data.

/** Exponential Moving Average */
export function calcEMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period) return closes.map(() => null);
  const k = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      ema += closes[i];
      result.push(null);
    } else if (i === period - 1) {
      ema = (ema + closes[i]) / period;
      result.push(ema);
    } else {
      ema = closes[i] * k + ema * (1 - k);
      result.push(ema);
    }
  }
  return result;
}

/** Simple Moving Average */
export function calcSMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      result.push(sum / period);
    }
  }
  return result;
}

/** Bollinger Bands (middle = SMA, upper/lower = middle ± stdDev * multiplier) */
export function calcBollingerBands(
  closes: number[],
  period: number = 20,
  mult: number = 2,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calcSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const m = middle[i];
    if (m === null) {
      upper.push(null);
      lower.push(null);
    } else {
      let variance = 0;
      for (let j = i - period + 1; j <= i; j++) variance += (closes[j] - m) ** 2;
      const std = Math.sqrt(variance / period);
      upper.push(m + mult * std);
      lower.push(m - mult * std);
    }
  }
  return { upper, middle, lower };
}

/** Relative Strength Index */
export function calcRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period + 1) return closes.map(() => null);

  let gainSum = 0;
  let lossSum = 0;
  // Seed with first `period` changes
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gainSum += delta;
    else lossSum -= delta;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  // Fill nulls for initial bars
  for (let i = 0; i <= period; i++) result.push(null);
  const rs = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result[period] = rs;

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

/** MACD (Moving Average Convergence Divergence) */
export function calcMACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9,
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const f = emaFast[i];
    const s = emaSlow[i];
    macdLine.push(f !== null && s !== null ? f - s : null);
  }
  // Signal line = EMA of MACD values (skip nulls)
  const validStart = macdLine.findIndex((v) => v !== null);
  const macdValues = macdLine.slice(validStart).map((v) => v!);
  const signalRaw = calcEMA(macdValues, signal);
  const signalLine: (number | null)[] = new Array(validStart).fill(null);
  const histogram: (number | null)[] = new Array(validStart).fill(null);
  for (let i = 0; i < signalRaw.length; i++) {
    const s = signalRaw[i];
    const m = macdValues[i];
    signalLine.push(s);
    histogram.push(s !== null ? m - s : null);
  }
  return { macd: macdLine, signal: signalLine, histogram };
}

/** Stochastic Oscillator (%K and %D) */
export function calcStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14,
  smooth: number = 3,
): { k: (number | null)[]; d: (number | null)[] } {
  const rawK: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      rawK.push(null);
    } else {
      let hh = -Infinity;
      let ll = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        if (highs[j] > hh) hh = highs[j];
        if (lows[j] < ll) ll = lows[j];
      }
      const range = hh - ll;
      rawK.push(range === 0 ? 50 : ((closes[i] - ll) / range) * 100);
    }
  }
  // %K = SMA(rawK, smooth)
  const kLine: (number | null)[] = [];
  for (let i = 0; i < rawK.length; i++) {
    if (rawK[i] === null || i < period - 1 + smooth - 1) {
      kLine.push(null);
    } else {
      let sum = 0;
      let count = 0;
      for (let j = i - smooth + 1; j <= i; j++) {
        if (rawK[j] !== null) { sum += rawK[j]!; count++; }
      }
      kLine.push(count > 0 ? sum / count : null);
    }
  }
  // %D = SMA(%K, smooth)
  const dLine: (number | null)[] = [];
  for (let i = 0; i < kLine.length; i++) {
    if (kLine[i] === null || i < period - 1 + 2 * (smooth - 1)) {
      dLine.push(null);
    } else {
      let sum = 0;
      let count = 0;
      for (let j = i - smooth + 1; j <= i; j++) {
        if (kLine[j] !== null) { sum += kLine[j]!; count++; }
      }
      dLine.push(count > 0 ? sum / count : null);
    }
  }
  return { k: kLine, d: dLine };
}

/** Generate synthetic volume values for a set of candles */
export function generateSyntheticVolume(count: number, baseVolume: number = 1000): number[] {
  const volumes: number[] = [];
  for (let i = 0; i < count; i++) {
    volumes.push(baseVolume * (0.5 + Math.random() * 1.5));
  }
  return volumes;
}
