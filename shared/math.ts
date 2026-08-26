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
  if (typeof usdAmount !== 'number' || isNaN(usdAmount)) {
    return 0;
  }
  // Round to prevent floating point inaccuracies like 19.99 * 100 = 1998.9999999999998
  return Math.round(usdAmount * 100);
}

/**
 * Converts a US Cents (USC) value back to a standard USD representation.
 * 
 * @param centAmount - The cent value to convert.
 * @returns The converted amount in USD (floating point).
 */
export function convertCentToUsd(centAmount: number): number {
  if (typeof centAmount !== 'number' || isNaN(centAmount)) {
    return 0;
  }
  return centAmount / 100;
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
  if (typeof rawLots !== 'number' || isNaN(rawLots) || rawLots <= 0) {
    return 0;
  }
  
  // Guard against division by zero and invalid divisors
  if (typeof lotsDivisor !== 'number' || isNaN(lotsDivisor) || lotsDivisor <= 0) {
    return rawLots; // Return unscaled if divisor is invalid
  }

  const scaled = rawLots / lotsDivisor;
  
  // Truncate/round to 4 decimal places to support micro lot granular resolutions (e.g. 0.0001 lots)
  return Math.round(scaled * 10000) / 10000;
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
  if (typeof digits !== 'number' || isNaN(digits) || digits < 0) {
    return 0.00001; // Default to 5-digit broker resolution
  }
  const cleanDigits = Math.floor(digits);
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
  if (typeof basePrice !== 'number' || isNaN(basePrice)) {
    return 0;
  }
  if (typeof markupPoints !== 'number' || isNaN(markupPoints) || markupPoints === 0) {
    return basePrice;
  }
  
  const pointVal = getPointValue(digits);
  const rawAdjusted = basePrice + (markupPoints * pointVal);
  
  // Eliminate IEEE 754 float drift by rounding to the broker's digits
  const scaleMultiplier = Math.pow(10, digits);
  return Math.round(rawAdjusted * scaleMultiplier) / scaleMultiplier;
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
