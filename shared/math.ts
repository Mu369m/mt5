/**
 * @file shared/math.ts
 * @description Shared Precision Point Engine and Currency/Volume conversion utility functions.
 * Designed to prevent floating-point representation errors and division-by-zero exceptions
 * inside high-frequency trading pipelines.
 * 
 * Connected Modules:
 * - backend/src/routes/sandbox.ts (validates test order sizing)
 * - mt-bridge/src/engine.ts (applies symbols spreads and scales transaction sizes)
 */

/**
 * Converts a standard USD value into US Cents (USC).
 * 1 USD is equivalent to 100 USC.
 *
 * @param usdAmount - The dollar value to convert.
 * @returns The converted amount in Cents (integer).
 */
export function convertUsdToCent(usdAmount: number): number {
  if (typeof usdAmount !== 'number' || !Number.isFinite(usdAmount) || usdAmount < 0) {
    return 0;
  }
  // Round to prevent floating point inaccuracies like 19.99 * 100 = 1998.9999999999998
  return Math.round((usdAmount + Number.EPSILON) * 100);
}

/**
 * Alias matching the requested USC terminology from the project brief.
 */
export function convertUsdToUsc(usdAmount: number): number {
  return convertUsdToCent(usdAmount);
}

/**
 * Converts a US Cents (USC) value back to a standard USD representation.
 *
 * @param centAmount - The cent value to convert.
 * @returns The converted amount in USD (floating point).
 */
export function convertCentToUsd(centAmount: number): number {
  if (typeof centAmount !== 'number' || !Number.isFinite(centAmount) || centAmount < 0) {
    return 0;
  }
  return centAmount / 100;
}

/**
 * Alias matching the requested USC terminology from the project brief.
 */
export function convertUscToUsd(uscAmount: number): number {
  return convertCentToUsd(uscAmount);
}

/**
 * Scales volume from a client account (e.g. Cent Account) into standard institutional sizes
 * by dividing the lot size by the target broker's configured lots divisor.
 * 
 * For example:
 * - Client submits 1.00 Cent lot on a Cent Account.
 * - target lots_divisor = 100.
 * - Standardized LP size = 1.00 / 100 = 0.01 Standard Lots.
 * 
 * Safeguards:
 * - Returns 0 if division by zero is attempted.
 * - Enforces minimum lot volume standard resolution (usually 2 decimal places, or 4 decimal places for micro-lots).
 * 
 * @param rawLots - The source volume submitted by client MT5.
 * @param lotsDivisor - The broker's scaling divisor (e.g. 100, 1000). Must be > 0.
 * @returns The scaled lot volume for target LP execution.
 */
export function scaleVolumeToDestination(rawLots: number, lotsDivisor: number): number {
  if (typeof rawLots !== 'number' || !Number.isFinite(rawLots) || rawLots <= 0) {
    return 0;
  }

  // Guard against division by zero and invalid divisors.
  if (typeof lotsDivisor !== 'number' || !Number.isFinite(lotsDivisor) || lotsDivisor <= 0) {
    return 0;
  }

  const scaled = rawLots / lotsDivisor;

  // Keep precision safe for downstream bridge and execution layers.
  return Math.round((scaled + Number.EPSILON) * 10000) / 10000;
}

/**
 * Calculates the absolute monetary value of 1 Point/Pip based on symbol pricing digits.
 * 
 * Digits mappings:
 * - 2 digits (e.g. USDJPY, XAUUSD): 1 Point = 0.01
 * - 3 digits (e.g. USDJPY 3-digit broker): 1 Point = 0.001
 * - 4 digits (e.g. EURUSD): 1 Point = 0.0001
 * - 5 digits (e.g. EURUSD 5-digit broker): 1 Point = 0.00001
 * 
 * @param digits - Number of decimal digits for the symbol pricing (0 to 8).
 * @returns The numerical representation of a single point (e.g., 0.00001).
 */
export function getPointValue(digits: number): number {
  if (typeof digits !== 'number' || !Number.isFinite(digits) || digits < 0) {
    return 0.00001; // Default to 5-digit broker resolution
  }

  const cleanDigits = Math.max(0, Math.floor(digits));
  return 1 / Math.pow(10, cleanDigits);
}

/**
 * Applies a custom points markup to a base price feed (Bid or Ask) with exact precision.
 * 
 * Formula:
 * AdjustedPrice = BasePrice + (MarkupPoints * PointValue)
 * 
 * Guard:
 * - Prevents negative values from resulting in bad price feeds.
 * - Truncates to exactly the target currency digits to avoid floating point precision residue.
 * 
 * @param basePrice - Raw market feed price (e.g., 1.08250).
 * @param markupPoints - Number of points to inject (e.g., 25 points or -10 points).
 * @param digits - Price resolution digits (e.g., 5).
 * @returns The final marked-up price ready for MT5 forwarding.
 */
export function applyMarkup(basePrice: number, markupPoints: number, digits: number): number {
  if (typeof basePrice !== 'number' || !Number.isFinite(basePrice)) {
    return 0;
  }
  if (typeof markupPoints !== 'number' || !Number.isFinite(markupPoints) || markupPoints === 0) {
    return basePrice;
  }

  const safeDigits = Math.max(0, Math.floor(digits));
  const pointVal = getPointValue(safeDigits);
  const rawAdjusted = basePrice + (markupPoints * pointVal);

  // Eliminate IEEE 754 float drift by rounding to the broker's digits
  const scaleMultiplier = Math.pow(10, safeDigits);
  return Math.round((rawAdjusted + Number.EPSILON) * scaleMultiplier) / scaleMultiplier;
}

/**
 * Computes execution slippage in points between requested price and actual filled price.
 * 
 * Slippage (Points) = |FilledPrice - RequestedPrice| / PointValue
 * 
 * @param requestedPrice - Price requested by trade order.
 * @param filledPrice - Price filled by liquidity provider.
 * @param digits - Symbol digits representation.
 * @returns Slippage in points (rounded to integer).
 */
export function calculateSlippage(requestedPrice: number, filledPrice: number, digits: number): number {
  if (!requestedPrice || !filledPrice || requestedPrice <= 0 || filledPrice <= 0) {
    return 0;
  }
  const pointValue = getPointValue(digits);
  if (pointValue === 0) {
    return 0;
  }
  const diff = Math.abs(filledPrice - requestedPrice);
  return Math.round(diff / pointValue);
}

/**
 * Converts a number of price points into a pips count. One pip is a 10-point
 * movement for the standard 4-digit feed mapping, and the conversion remains
 * safe for 2/3/4/5-digit symbols through the symbol resolution constant.
 */
export function pointsToPips(points: number, digits = 5): number {
  if (typeof points !== 'number' || !Number.isFinite(points)) {
    return 0;
  }

  const safeDigits = Math.max(0, Math.floor(digits));
  const scale = Math.max(1, Math.pow(10, Math.max(0, safeDigits - 4)));
  return Math.round((Math.abs(points) / scale) * 10000) / 10000;
}

/**
 * Converts pips back into price points using the same symbol precision rule.
 */
export function pipsToPoints(pips: number, digits = 5): number {
  if (typeof pips !== 'number' || !Number.isFinite(pips)) {
    return 0;
  }

  const safeDigits = Math.max(0, Math.floor(digits));
  const scale = Math.max(1, Math.pow(10, Math.max(0, safeDigits - 4)));
  return Math.round((Math.abs(pips) * scale) * 10000) / 10000;
}

/**
 * Safe bid-side markup application, matching the requested price feed policy.
 */
export function applyBidMarkup(basePrice: number, markupPoints: number, digits: number): number {
  return applyMarkup(basePrice, markupPoints, digits);
}

/**
 * Safe ask-side markup application for bid/ask price streams.
 */
export function applyAskMarkup(basePrice: number, markupPoints: number, digits: number): number {
  return applyMarkup(basePrice, markupPoints, digits);
}

/**
 * Price passthrough utility: returns the incoming price unchanged for a safe
 * source-spread/fill-price feed bypass.
 */
export function passthroughPrice(price: number): number {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return 0;
  }
  return price;
}

/**
 * Decimal-safe rounding helper requested by the project brief for broker price
 * feeds and order-policy normalization.
 */
export function roundDecimal(value: number, digits = 4): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  const safeDigits = Math.max(0, Math.floor(digits));
  const scale = Math.pow(10, safeDigits);
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

/**
 * Filter out invalid or non-positive orders before routing, to keep the bridge
 * and execution layer from sending an unsafe zero or negative trade size.
 */
export function normalizeValidLots(lots: number, minimumLots = 0.01): number {
  if (typeof lots !== 'number' || !Number.isFinite(lots) || lots <= 0) {
    return 0;
  }

  if (lots < minimumLots) {
    return 0;
  }

  return roundDecimal(lots, 4);
}

/**
 * Scale a lot volume back from one destination size to source account size.
 * This is the inverse of the requested divisor scaling rule.
 */
export function scaleVolumeFromDestination(rawLots: number, lotsDivisor: number): number {
  if (typeof rawLots !== 'number' || !Number.isFinite(rawLots) || rawLots < 0) {
    return 0;
  }

  if (typeof lotsDivisor !== 'number' || !Number.isFinite(lotsDivisor) || lotsDivisor <= 0) {
    return rawLots;
  }

  return Math.round((rawLots * lotsDivisor + Number.EPSILON) * 10000) / 10000;
}
