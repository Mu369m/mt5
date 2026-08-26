/**
 * @file mt-bridge/src/smart-routing.ts
 * @description Proprietary Feature A: AI Toxic Flow Detection and Smart LP Slippage Engine.
 * Evaluates real-time execution statistics to recommend the lowest slippage route,
 * and intercepts high-frequency latency arbitrage bots to secure B-Book liquidity.
 * 
 * Connected Modules:
 * - mt-bridge/src/engine.ts (invokes routers and latency injections)
 */

import prisma from './db';

// Memory cache recording recent trade execution history to build real-time AI profiles
interface SlippageRecord {
  destinationId: string;
  slippagePoints: number;
  latencyMs: number;
  timestamp: number;
}

// In-memory telemetry log of execution stats: Map<Symbol, SlippageRecord[]>
const executionHistory = new Map<string, SlippageRecord[]>();

// In-memory rate-limiter tracker for toxic flow detection: Map<SourceGroup, number[]> (timestamps of recent trades)
const tradeActivityTracker = new Map<string, number[]>();

/**
 * Feeds a completed trade execution metrics back into the AI router memory database.
 * 
 * @param symbol - Traded asset (e.g. EURUSD).
 * @param destinationId - The executing Liquidity Provider.
 * @param slippagePoints - Slippage recorded in points.
 * @param latencyMs - Latency response recorded in ms.
 */
export function recordExecutionMetrics(
  symbol: string,
  destinationId: string,
  slippagePoints: number,
  latencyMs: number
): void {
  let records = executionHistory.get(symbol);
  if (!records) {
    records = [];
    executionHistory.set(symbol, records);
  }

  // Push fresh stats and keep history capped to last 100 entries per symbol to limit RAM usage
  records.push({
    destinationId,
    slippagePoints,
    latencyMs,
    timestamp: Date.now(),
  });

  if (records.length > 100) {
    records.shift();
  }
}

/**
 * Smart LP Routing: Analyzes historical trade slippage logs to determine which Liquidity Provider
 * is currently offering the lowest slippage on a specific symbol.
 * 
 * @param symbol - Target symbol (e.g. BTCUSD).
 * @param candidateDestIds - Array of allowed destination IDs configured under tenant rules.
 * @returns The recommended destination ID offering the cleanest pricing.
 */
export function selectBestSlippageDestination(symbol: string, candidateDestIds: string[]): string | null {
  if (!candidateDestIds || candidateDestIds.length === 0) {
    return null;
  }

  const records = executionHistory.get(symbol);
  if (!records || records.length === 0) {
    // No historical records; fall back to the first available routing candidate
    return candidateDestIds[0];
  }

  // Calculate average slippage points per candidate destination over the last 15 minutes
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  const sums = new Map<string, { totalPoints: number; count: number }>();

  for (const r of records) {
    if (r.timestamp >= fifteenMinutesAgo && candidateDestIds.includes(r.destinationId)) {
      const entry = sums.get(r.destinationId) || { totalPoints: 0, count: 0 };
      entry.totalPoints += r.slippagePoints;
      entry.count += 1;
      sums.set(r.destinationId, entry);
    }
  }

  let bestDestId = candidateDestIds[0];
  let lowestAverage = Infinity;

  for (const destId of candidateDestIds) {
    const entry = sums.get(destId);
    if (entry && entry.count > 0) {
      const avg = entry.totalPoints / entry.count;
      if (avg < lowestAverage) {
        lowestAverage = avg;
        bestDestId = destId;
      }
    }
  }

  return bestDestId;
}

/**
 * Latency Arbitrage Guard: Analyzes trade frequency and execution signatures to detect high-frequency
 * toxic trading patterns. Returns a delay duration in milliseconds (50ms - 200ms) if toxic behavior is identified.
 * 
 * Signature analysis parameters:
 * - Detects if a single MT5 source group dispatches more than 3 orders within a rolling 2-second window.
 * - Flag immediate large blocks (> 50 lots) as potential toxic sweeps.
 * 
 * @param sourceGroup - The MT5 client group.
 * @param lots - The trade size.
 * @returns The latency duration in ms to inject as a guard (0 if flow is safe).
 */
export function assessToxicFlowAndCalculateDelay(sourceGroup: string, lots: number): { isToxic: boolean; delayMs: number } {
  const now = Date.now();
  let timestamps = tradeActivityTracker.get(sourceGroup) || [];

  // Filter timestamps to the last 2 seconds
  timestamps = timestamps.filter(ts => now - ts <= 2000);
  timestamps.push(now);
  tradeActivityTracker.set(sourceGroup, timestamps);

  // 1. Rapid fire frequency check (>3 orders in 2 seconds)
  const isHighFrequency = timestamps.length > 3;

  // 2. Toxic block size sweep check (>50 lots)
  const isLargeToxicSweep = lots >= 50.0;

  if (isHighFrequency || isLargeToxicSweep) {
    // Calculate dynamic delay based on frequency (higher frequency = higher defense delay)
    // Delay ranges between 50ms (baseline toxic defense) up to 200ms
    const frequencyMultiplier = Math.min(4, timestamps.length);
    const delay = isLargeToxicSweep ? 200 : Math.min(200, 50 * frequencyMultiplier);
    
    return {
      isToxic: true,
      delayMs: delay,
    };
  }

  return {
    isToxic: false,
    delayMs: 0,
  };
}
