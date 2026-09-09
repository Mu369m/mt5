/**
 * @file mt-bridge/src/risk.ts
 * @description Deterministic flow classification, lot sizing, direction reversal,
 * and pre-trade filtering for A/B/C-book routing.
 */

import type { ExecutionControlConfig, FlowClassification, FlowProfileInput, RiskEvaluation, RoutingBook } from '@workspace/shared';

function assertValidFlowInput(input: FlowProfileInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid flow profile input');
  }

  const numericFields = [
    input.winRate,
    input.averageHoldTimeSeconds,
    input.executionsLastHour,
    input.averageLotSize,
    input.toxicScore,
  ];

  if (numericFields.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('Invalid flow profile input');
  }

  if (input.winRate < 0 || input.winRate > 1) {
    throw new Error('Invalid flow profile input');
  }
  if (input.toxicScore < 0 || input.toxicScore > 1) {
    throw new Error('Invalid flow profile input');
  }
}

export function classifyFlow(input: FlowProfileInput): FlowClassification {
  assertValidFlowInput(input);

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
  if (!config || typeof config !== 'object') return 0;
  if (!Number.isFinite(masterLots) || masterLots <= 0) return 0;
  if (!Number.isFinite(masterEquity) || masterEquity <= 0) return 0;
  if (!Number.isFinite(slaveEquity) || slaveEquity <= 0) return 0;

  const allowedModes = ['FIXED', 'RISK_PERCENT', 'EQUITY_RATIO', 'CUSTOM_RATIO'];
  if (typeof config.lotSizingMode !== 'string' || !allowedModes.includes(config.lotSizingMode)) return 0;

  if (config.lotSizingMode === 'FIXED') {
    if (!Number.isFinite(config.fixedLots) || config.fixedLots < 0) return 0;
    return Math.max(0, config.fixedLots);
  }

  if (config.lotSizingMode === 'EQUITY_RATIO') {
    if (!Number.isFinite(config.customRatio) || config.customRatio < 0) return 0;
    return Math.max(0, masterLots * (slaveEquity / Math.max(masterEquity, 0.000001)));
  }

  if (config.lotSizingMode === 'CUSTOM_RATIO') {
    if (!Number.isFinite(config.customRatio) || config.customRatio < 0) return 0;
    return Math.max(0, masterLots * Math.max(config.customRatio, 0));
  }

  if (!Number.isFinite(config.riskPercent) || config.riskPercent < 0) return 0;
  return Math.max(0, (slaveEquity * Math.max(config.riskPercent, 0) / 100) * masterLots / Math.max(masterEquity, 0.000001));
}

export function evaluateTrade(config: ExecutionControlConfig, symbol: string, direction: 'BUY' | 'SELL', volumeLots: number, book: RoutingBook, currentBBookExposureLots: number): RiskEvaluation {
  if (!config || typeof config !== 'object') {
    return { allowed: false, reason: 'Invalid execution config', direction, volumeLots, book };
  }

  if (!Array.isArray(config.symbolWhitelist) || !Array.isArray(config.symbolBlacklist)) {
    return { allowed: false, reason: 'Invalid execution config', direction, volumeLots, book };
  }

  if (typeof symbol !== 'string' || !symbol.trim()) {
    return { allowed: false, reason: 'Invalid symbol or volume', direction, volumeLots, book };
  }
  if (!['BUY', 'SELL'].includes(direction)) {
    return { allowed: false, reason: 'Invalid direction', direction, volumeLots, book };
  }

  const normalized = symbol.trim().toUpperCase();
  if (!normalized || !Number.isFinite(volumeLots) || volumeLots <= 0) return { allowed: false, reason: 'Invalid symbol or volume', direction, volumeLots, book };
  if (config.symbolWhitelist.length > 0 && !config.symbolWhitelist.includes(normalized)) return { allowed: false, reason: 'Symbol is not whitelisted', direction, volumeLots, book };
  if (config.symbolBlacklist.includes(normalized)) return { allowed: false, reason: 'Symbol is blacklisted', direction, volumeLots, book };
  if (book === 'B_BOOK' && currentBBookExposureLots + volumeLots > config.maxBBookExposureLots) return { allowed: false, reason: 'B-Book exposure cap exceeded; spill over to A-Book', direction, volumeLots, book };
  return { allowed: true, direction: config.reverseTrading ? direction === 'BUY' ? 'SELL' : 'BUY' : direction, volumeLots, book };
}
