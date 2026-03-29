/**
 * Instrument configuration for realistic paper trading.
 *
 * Each instrument defines:
 * - contract_size: units per 1.0 standard lot
 * - lot_step: minimum lot increment
 * - min_lot: minimum tradeable lot
 * - max_lot: maximum tradeable lot
 * - pip_size: value of 1 pip in price terms
 * - digits: decimal places for price display
 * - type: instrument category
 */

export type InstrumentType = "forex" | "metal" | "crypto" | "index" | "energy";

export interface InstrumentConfig {
  symbol: string;
  type: InstrumentType;
  contract_size: number;
  lot_step: number;
  min_lot: number;
  max_lot: number;
  pip_size: number;
  digits: number;
}

// ── Instrument registry ──────────────────────────────────────────────────────

const INSTRUMENTS: Record<string, InstrumentConfig> = {
  // Forex majors — 100,000 units per lot
  EURUSD:  { symbol: "EURUSD",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.0001, digits: 5 },
  GBPUSD:  { symbol: "GBPUSD",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.0001, digits: 5 },
  USDJPY:  { symbol: "USDJPY",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.01,   digits: 3 },
  USDCHF:  { symbol: "USDCHF",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.0001, digits: 5 },
  AUDUSD:  { symbol: "AUDUSD",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.0001, digits: 5 },
  NZDUSD:  { symbol: "NZDUSD",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.0001, digits: 5 },
  USDCAD:  { symbol: "USDCAD",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.0001, digits: 5 },

  // Forex crosses
  GBPJPY:  { symbol: "GBPJPY",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.01,   digits: 3 },
  EURJPY:  { symbol: "EURJPY",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.01,   digits: 3 },
  EURGBP:  { symbol: "EURGBP",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.0001, digits: 5 },
  AUDCAD:  { symbol: "AUDCAD",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.0001, digits: 5 },
  NZDJPY:  { symbol: "NZDJPY",  type: "forex", contract_size: 100_000, lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.01,   digits: 3 },

  // Precious metals — 100 oz per lot (Gold), 5000 oz (Silver)
  XAUUSD:  { symbol: "XAUUSD",  type: "metal", contract_size: 100,   lot_step: 0.01, min_lot: 0.01, max_lot: 50,  pip_size: 0.01, digits: 2 },
  XAGUSD:  { symbol: "XAGUSD",  type: "metal", contract_size: 5_000, lot_step: 0.01, min_lot: 0.01, max_lot: 50,  pip_size: 0.001, digits: 3 },

  // Indices — 1 contract per lot (CFD-style)
  NAS100:  { symbol: "NAS100",  type: "index", contract_size: 1,  lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.01, digits: 2 },
  US30:    { symbol: "US30",    type: "index", contract_size: 1,  lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.01, digits: 2 },
  US500:   { symbol: "US500",   type: "index", contract_size: 1,  lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.01, digits: 2 },
  SPX500:  { symbol: "SPX500",  type: "index", contract_size: 1,  lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.01, digits: 2 },
  DXY:     { symbol: "DXY",     type: "index", contract_size: 1,  lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.01, digits: 3 },

  // Energy
  USOIL:   { symbol: "USOIL",   type: "energy", contract_size: 1_000, lot_step: 0.01, min_lot: 0.01, max_lot: 50, pip_size: 0.01, digits: 2 },
  UKOIL:   { symbol: "UKOIL",   type: "energy", contract_size: 1_000, lot_step: 0.01, min_lot: 0.01, max_lot: 50, pip_size: 0.01, digits: 2 },

  // Crypto — 1 coin per lot
  BTCUSD:  { symbol: "BTCUSD",  type: "crypto", contract_size: 1,  lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.01, digits: 2 },
  ETHUSD:  { symbol: "ETHUSD",  type: "crypto", contract_size: 1,  lot_step: 0.01, min_lot: 0.01, max_lot: 100, pip_size: 0.01, digits: 2 },
  SOLUSD:  { symbol: "SOLUSD",  type: "crypto", contract_size: 1,  lot_step: 0.01, min_lot: 0.01, max_lot: 1000, pip_size: 0.01, digits: 2 },
};

// ── Public API ───────────────────────────────────────────────────────────────

/** Default config for unknown symbols — treated as forex-like. */
const DEFAULT_CONFIG: InstrumentConfig = {
  symbol: "UNKNOWN",
  type: "forex",
  contract_size: 100_000,
  lot_step: 0.01,
  min_lot: 0.01,
  max_lot: 100,
  pip_size: 0.0001,
  digits: 5,
};

/** Get instrument config by symbol. Falls back to forex defaults. */
export function getInstrument(symbol: string): InstrumentConfig {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return INSTRUMENTS[s] ?? { ...DEFAULT_CONFIG, symbol: s };
}

/** List all known instrument symbols. */
export function allInstrumentSymbols(): string[] {
  return Object.keys(INSTRUMENTS);
}

/** Check if a symbol is known. */
export function isKnownInstrument(symbol: string): boolean {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, "") in INSTRUMENTS;
}

// ── Calculations ────────────────────────────────────────────────────────────

/**
 * Position value = lots × contract_size × entry_price
 * (For forex: 0.01 lot EURUSD at 1.0850 = 0.01 × 100,000 × 1.0850 = $1,085)
 */
export function positionValue(lots: number, contractSize: number, price: number): number {
  return lots * contractSize * price;
}

/**
 * Required margin = position_value / leverage
 */
export function requiredMargin(lots: number, contractSize: number, price: number, leverage: number): number {
  return positionValue(lots, contractSize, price) / leverage;
}

/**
 * Calculate PnL using contract_size.
 *
 * BUY:  pnl = (exit - entry) × lots × contract_size
 * SELL: pnl = (entry - exit) × lots × contract_size
 */
export function calculateDemoPnL(
  direction: "buy" | "sell",
  entryPrice: number,
  exitPrice: number,
  lots: number,
  contractSize: number,
): number {
  const diff = direction === "buy"
    ? exitPrice - entryPrice
    : entryPrice - exitPrice;
  return Number((diff * lots * contractSize).toFixed(2));
}

/**
 * Validate lot size against instrument config.
 * Returns error string or null if valid.
 */
export function validateLotSize(lots: number, config: InstrumentConfig): string | null {
  if (lots < config.min_lot) return `Minimum lot size is ${config.min_lot}`;
  if (lots > config.max_lot) return `Maximum lot size is ${config.max_lot}`;

  // Check lot step alignment (handle floating point)
  const steps = Math.round(lots / config.lot_step);
  const aligned = steps * config.lot_step;
  if (Math.abs(lots - aligned) > 1e-8) {
    return `Lot size must be a multiple of ${config.lot_step}`;
  }

  return null;
}
