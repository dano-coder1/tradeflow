/**
 * Currency detection from trade symbols and PnL formatting.
 *
 * Infers the account/quote currency from the user's traded symbols
 * and formats PnL values with the correct currency symbol.
 */

import type { Trade } from "@/types/trade";

// Quote currency = last 3 chars for standard forex pairs
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CHF: "Fr",
  CAD: "C$",
  AUD: "A$",
  NZD: "NZ$",
  HKD: "HK$",
  SGD: "S$",
};

// Symbols that are inherently USD-denominated
const USD_QUOTED = new Set([
  "XAUUSD", "XAGUSD", "BTCUSD", "ETHUSD", "SOLUSD",
  "NAS100", "US30", "US500", "SPX500", "DXY", "USOIL", "UKOIL",
]);

/**
 * Detect the most likely account currency from a set of trades.
 * Strategy: count quote currencies across all symbols; most frequent wins.
 * Falls back to "USD".
 */
export function detectCurrency(trades: Trade[]): string {
  if (trades.length === 0) return "USD";

  const counts = new Map<string, number>();

  for (const t of trades) {
    const sym = t.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (USD_QUOTED.has(sym)) {
      counts.set("USD", (counts.get("USD") ?? 0) + 1);
      continue;
    }

    // Standard 6-char forex pair (EURUSD → quote = USD)
    if (sym.length === 6 && /^[A-Z]{6}$/.test(sym)) {
      const quote = sym.slice(3);
      counts.set(quote, (counts.get(quote) ?? 0) + 1);
      continue;
    }

    // Crypto with slash or known suffix
    if (sym.endsWith("USD") || sym.endsWith("USDT")) {
      counts.set("USD", (counts.get("USD") ?? 0) + 1);
      continue;
    }

    // Default to USD for unrecognized
    counts.set("USD", (counts.get("USD") ?? 0) + 1);
  }

  // Pick most frequent
  let best = "USD";
  let bestCount = 0;
  for (const [cur, count] of counts) {
    if (count > bestCount) {
      best = cur;
      bestCount = count;
    }
  }
  return best;
}

/** Get the symbol character(s) for a currency code. */
export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? "$";
}

/**
 * Format a PnL value with currency symbol and sign.
 * Examples: +$24.01, -€67.46, +¥1,200
 *
 * @param amount     The PnL number
 * @param currency   3-letter code (USD, EUR, etc.)
 * @param compact    If true, round to integer for small display
 */
export function formatPnL(
  amount: number,
  currency: string,
  compact = false,
): string {
  const sym = currencySymbol(currency);
  const sign = amount >= 0 ? "+" : "-";
  const abs = Math.abs(amount);
  const value = compact ? Math.round(abs).toString() : abs.toFixed(2);
  return `${sign}${sym}${value}`;
}
