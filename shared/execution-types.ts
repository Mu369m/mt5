/**
 * @file shared/execution-types.ts
 * @description Shared contracts for dual-mode execution, dealer controls, and copier risk guards.
 */

export type ExecutionPipelineMode = 'SIMULATED' | 'LIVE';
export type RoutingBook = 'A_BOOK' | 'B_BOOK' | 'C_BOOK';
export type RoutingMode = 'B_BOOK_INTERNAL' | 'A_BOOK_FIX' | 'HYBRID_AUTO';
export type LotSizingMode = 'FIXED' | 'RISK_PERCENT' | 'EQUITY_RATIO' | 'CUSTOM_RATIO';

export interface ExecutionControlConfig {
  mode: ExecutionPipelineMode;
  routingMode: RoutingMode;
  asymmetricSlippageEnabled: boolean;
  latencyInjectionEnabled: boolean;
  latencyInjectionMs: number;
  requoteEnabled: boolean;
  maxExecutionTtlMs: number;
  reverseTrading: boolean;
  symbolWhitelist: string[];
  symbolBlacklist: string[];
  magicNumbers: number[];
  commentIncludes: string[];
  maxDailyLossPercent: number;
  maxDrawdownPercent: number;
  maxBBookExposureLots: number;
  lotSizingMode: LotSizingMode;
  fixedLots: number;
  riskPercent: number;
  customRatio: number;
  profitSharePerLot: number;
}

export interface FlowProfileInput {
  winRate: number;
  averageHoldTimeSeconds: number;
  executionsLastHour: number;
  averageLotSize: number;
  toxicScore: number;
}

export interface FlowClassification {
  book: RoutingBook;
  score: number;
  delayInjected: boolean;
  reasons: string[];
}

export interface RiskEvaluation {
  allowed: boolean;
  reason?: string;
  direction: 'BUY' | 'SELL';
  volumeLots: number;
  book: RoutingBook;
}

export interface ExecutionCommand {
  commandId: string;
  eventType: 'OPEN' | 'MODIFY' | 'CLOSE' | 'PARTIAL_CLOSE' | 'CANCEL';
  ticket: string;
  symbol: string;
  volumeLots?: number;
  maxDeviationPoints: number;
  ttlMs: number;
}
