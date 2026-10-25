/**
 * Centralized Financial Calculation & Currency Formatting Utility
 * Provides deterministic decimal arithmetic and locale-aware currency presentation.
 */

export const SUPPORTED_CURRENCIES = {
  INR: { code: "INR", symbol: "₹", locale: "en-IN", name: "Indian Rupee" },
  USD: { code: "USD", symbol: "$", locale: "en-US", name: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", locale: "de-DE", name: "Euro" },
  GBP: { code: "GBP", symbol: "£", locale: "en-GB", name: "British Pound" },
  CAD: { code: "CAD", symbol: "$", locale: "en-CA", name: "Canadian Dollar" },
  AUD: { code: "AUD", symbol: "$", locale: "en-AU", name: "Australian Dollar" },
  JPY: { code: "JPY", symbol: "¥", locale: "ja-JP", name: "Japanese Yen", decimals: 0 },
};

export const DEFAULT_CURRENCY = "INR";

/**
 * Safely rounds a number to a fixed decimal count avoiding binary floating point drift.
 * Example: roundFinancial(1.005, 2) => 1.01
 */
export function roundFinancial(value, decimals = 2) {
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) return 0;
  return Number(Math.round(Number(num + "e" + decimals)) + "e-" + decimals);
}

/**
 * Converts monetary amount to smallest fractional units (cents/paise) for integer arithmetic.
 */
export function toCents(amount, decimals = 2) {
  const rounded = roundFinancial(amount, decimals);
  const factor = Math.pow(10, decimals);
  return Math.round(rounded * factor);
}

/**
 * Converts integer cents back to decimal currency unit.
 */
export function fromCents(cents, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return roundFinancial(cents / factor, decimals);
}

/**
 * Deterministic decimal addition.
 */
export function safeAdd(a, b, decimals = 2) {
  return fromCents(toCents(a, decimals) + toCents(b, decimals), decimals);
}

/**
 * Deterministic decimal subtraction.
 */
export function safeSubtract(a, b, decimals = 2) {
  return fromCents(toCents(a, decimals) - toCents(b, decimals), decimals);
}

/**
 * Deterministic decimal multiplication.
 */
export function safeMultiply(amount, multiplier, decimals = 2) {
  const num = typeof amount === "number" ? amount : Number(amount);
  const factor = typeof multiplier === "number" ? multiplier : Number(multiplier);
  if (isNaN(num) || isNaN(factor)) return 0;
  return roundFinancial(num * factor, decimals);
}

/**
 * Formats a monetary number into a localized currency string.
 * @param {number|string} amount - The amount to format
 * @param {string} currencyCode - ISO 4217 currency code (default: INR)
 * @param {object} options - Intl.NumberFormat options
 * @returns {string} Formatted currency string (e.g., "₹1,250.00" or "$1,250.00")
 */
export function formatCurrency(amount, currencyCode = DEFAULT_CURRENCY, options = {}) {
  const num = typeof amount === "number" ? amount : Number(amount);
  const safeNum = isNaN(num) ? 0 : num;
  const config = SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];
  const decimals = options.minimumFractionDigits ?? (config.decimals !== undefined ? config.decimals : 2);

  try {
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      ...options,
    }).format(safeNum);
  } catch (_error) {
    // Fallback if locale format is unavailable in runtime
    return `${config.symbol}${roundFinancial(safeNum, decimals).toFixed(decimals)}`;
  }
}

/**
 * Returns the currency symbol for a given currency code.
 */
export function getCurrencySymbol(currencyCode = DEFAULT_CURRENCY) {
  return (SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY]).symbol;
}
