/**
 * @file mt-bridge/src/netting.ts
 * @description Proprietary Feature B: Internal Trade Netting & B-Book Offset Engine.
 * Calculates aggregate client exposure per symbol in real-time. Matches matching counter-orders
 * internally to reduce external broker commissions and risk overhead.
 * 
 * Connected Modules:
 * - mt-bridge/src/engine.ts (checks for netting offsets before LP forwarding)
 */

interface NetExposure {
  symbol: string;
  netVolume: number; // Positive for net Buy, negative for net Sell
  totalBuyLots: number;
  totalSellLots: number;
  savedCommissionsUsd: number;
}

// In-memory tenant exposure registry: Map<TenantId, Map<Symbol, NetExposure>>
const tenantExposures = new Map<string, Map<string, NetExposure>>();

// Estimated commission rate saved per lot by netting internally (e.g. $6.00 per Standard Lot round turn)
const LP_COMMISSION_PER_LOT = 6.0;

/**
 * Returns the current net exposure profile for a specific tenant and symbol.
 * 
 * @param tenantId - The unique tenant ID.
 * @param symbol - The symbol name.
 */
export function getExposure(tenantId: string, symbol: string): NetExposure {
  let tenantMap = tenantExposures.get(tenantId);
  if (!tenantMap) {
    tenantMap = new Map<string, NetExposure>();
    tenantExposures.set(tenantId, tenantMap);
  }

  let exposure = tenantMap.get(symbol);
  if (!exposure) {
    exposure = {
      symbol,
      netVolume: 0,
      totalBuyLots: 0,
      totalSellLots: 0,
      savedCommissionsUsd: 0,
    };
    tenantMap.set(symbol, exposure);
  }

  return exposure;
}

/**
 * Evaluates whether an incoming trade direction offsets the current net open risk.
 * If the trade is an offset, it can be matched internally (B-Book) without LP routing.
 * 
 * Example Scenario:
 * - Current Net Exposure on EURUSD = +10.0 Lots (Buy Heavy)
 * - Incoming Client Order = SELL 3.0 Lots
 * - Result: Netted! Net exposure drops to +7.0 Lots. LP commission is 100% saved on 3.0 Lots.
 * 
 * @param tenantId - Tenant ID context.
 * @param symbol - Asset being traded.
 * @param direction - 'BUY' or 'SELL'.
 * @param volumeLots - Size of trade.
 * @returns An object describing the netting evaluation.
 */
export function processNettingOffset(
  tenantId: string,
  symbol: string,
  direction: 'BUY' | 'SELL',
  volumeLots: number
): {
  isFullyNetted: boolean;
  nettedVolume: number;
  forwardVolume: number;
  savedCommission: number;
  newExposure: number;
} {
  const exposure = getExposure(tenantId, symbol);
  const currentNet = exposure.netVolume;

  let isFullyNetted = false;
  let nettedVolume = 0;
  let forwardVolume = volumeLots;
  let savedCommission = 0;

  // Check if incoming order is in the opposite direction of aggregate exposure
  if (direction === 'BUY' && currentNet < 0) {
    // Current exposure is net Sell (negative). Incoming Buy offsets it.
    const absoluteNet = Math.abs(currentNet);
    nettedVolume = Math.min(volumeLots, absoluteNet);
    forwardVolume = Math.max(0, volumeLots - absoluteNet);
    isFullyNetted = forwardVolume === 0;
  } else if (direction === 'SELL' && currentNet > 0) {
    // Current exposure is net Buy (positive). Incoming Sell offsets it.
    nettedVolume = Math.min(volumeLots, currentNet);
    forwardVolume = Math.max(0, volumeLots - currentNet);
    isFullyNetted = forwardVolume === 0;
  }

  // Update real-time exposure registry
  if (direction === 'BUY') {
    exposure.totalBuyLots += volumeLots;
    exposure.netVolume += volumeLots;
  } else {
    exposure.totalSellLots += volumeLots;
    exposure.netVolume -= volumeLots;
  }

  // Round to 4 decimals to avoid floating point residues
  exposure.netVolume = Math.round(exposure.netVolume * 10000) / 10000;

  if (nettedVolume > 0) {
    savedCommission = nettedVolume * LP_COMMISSION_PER_LOT;
    exposure.savedCommissionsUsd += savedCommission;
    exposure.savedCommissionsUsd = Math.round(exposure.savedCommissionsUsd * 100) / 100;
  }

  return {
    isFullyNetted,
    nettedVolume,
    forwardVolume,
    savedCommission,
    newExposure: exposure.netVolume,
  };
}

/**
 * Returns all active exposure profiles tracked in the system for a tenant.
 * 
 * @param tenantId - The unique tenant ID.
 */
export function getTenantExposures(tenantId: string): NetExposure[] {
  const tenantMap = tenantExposures.get(tenantId);
  if (!tenantMap) {
    return [];
  }
  return Array.from(tenantMap.values());
}
