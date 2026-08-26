/**
 * @file mt-bridge/src/risk.ts
 * @description Deterministic flow classification, lot sizing, direction reversal,
 * and pre-trade filtering for A/B/C-book routing.
 */

import type { ExecutionControlConfig, FlowClassification, FlowProfileInput, RiskEvaluation, RoutingBook } from '@workspace/shared';

export function classifyFlow(input: FlowProfileInput): FlowClassification {
  const reasons: string[] = [];
  let score = 0;
  if (input.winRate >= 0.65) { score += 35; reasons.push('high win rate'); }
  if (input.averageHoldTimeSeconds <= 30) { score += 20; reasons.push('short holding time'); }
  if (input.executionsLastHour >= 60) { score += 25; reasons.push('high execution frequency'); }
  if (input.averageLotSize >= 10) { score += 10; reasons.push('large average size'); }
  if (input.toxicScore >= 0.7) { score += 20; reasons.push('toxic-flow score'); }
  const book: RoutingBook = score >= 65 ? 'A_BOOK' : score >= 35 ? 'C_BOOK' : 'B_BOOK';
  return { book, score: Math.min(100, score), delayInjected: input.toxicScore >= 0.7, reasons };
}

export function calculateCopyLots(config: ExecutionControlConfig, masterLots: number, masterEquity: number, slaveEquity: number): number {
  if (!Number.isFinite(masterLots) || masterLots <= 0) return 0;
  if (config.lotSizingMode === 'FIXED') return Math.max(0, config.fixedLots);
  if (config.lotSizingMode === 'EQUITY_RATIO') return Math.max(0, masterLots * (slaveEquity / Math.max(masterEquity, 0.000001)));
  if (config.lotSizingMode === 'CUSTOM_RATIO') return Math.max(0, masterLots * Math.max(config.customRatio, 0));
  return Math.max(0, (slaveEquity * Math.max(config.riskPercent, 0) / 100) * masterLots / Math.max(masterEquity, 0.000001));
}

export function evaluateTrade(config: ExecutionControlConfig, symbol: string, direction: 'BUY' | 'SELL', volumeLots: number, book: RoutingBook, currentBBookExposureLots: number): RiskEvaluation {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized || !Number.isFinite(volumeLots) || volumeLots <= 0) return { allowed: false, reason: 'Invalid symbol or volume', direction, volumeLots, book };
  if (config.symbolWhitelist.length > 0 && !config.symbolWhitelist.includes(normalized)) return { allowed: false, reason: 'Symbol is not whitelisted', direction, volumeLots, book };
  if (config.symbolBlacklist.includes(normalized)) return { allowed: false, reason: 'Symbol is blacklisted', direction, volumeLots, book };
  if (book === 'B_BOOK' && currentBBookExposureLots + volumeLots > config.maxBBookExposureLots) return { allowed: false, reason: 'B-Book exposure cap exceeded; spill over to A-Book', direction, volumeLots, book };
  return { allowed: true, direction: config.reverseTrading ? direction === 'BUY' ? 'SELL' : 'BUY' : direction, volumeLots, book };
}
