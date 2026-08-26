/**
 * @file shared/copier-types.ts
 * @description Transport contracts for Master-to-Slave trade copying.
 * Used by MT4/MT5 adapters, backend ingestion routes, and the bridge dispatcher.
 */

export type CopierPlatform = 'MT4' | 'MT5';
export type CopierConnectionRole = 'MASTER' | 'SLAVE';
export type CopierConnectionStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';
export type CopierEventType = 'ORDER_OPEN' | 'ORDER_MODIFY' | 'ORDER_CLOSE' | 'PARTIAL_CLOSE' | 'PENDING_TRIGGER';
export type CopierEventStatus = 'RECEIVED' | 'DISPATCHED' | 'APPLIED' | 'FAILED' | 'DUPLICATE';
export type CopierDirection = 'BUY' | 'SELL';

export interface CopierConnection {
  id: string;
  tenantId: string;
  name: string;
  platform: CopierPlatform;
  role: CopierConnectionRole;
  status: CopierConnectionStatus;
  lastHeartbeatAt: string | null;
  terminalVersion?: string | null;
}

export interface CopierProfile {
  id: string;
  tenantId: string;
  name: string;
  masterConnectionId: string;
  enabled: boolean;
  maxSlippagePoints: number;
  volumeMultiplier: number;
}

export interface CopierTradeEvent {
  eventId: string;
  profileId: string;
  masterConnectionId: string;
  masterTicket: string;
  eventType: CopierEventType;
  symbol: string;
  direction?: CopierDirection;
  volumeLots?: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  closeVolumeLots?: number;
  occurredAt: string;
}

export interface CopierDispatchResult {
  eventId: string;
  status: CopierEventStatus;
  slaveConnectionId: string;
  slaveTicket?: string;
  latencyMs: number;
  errorMessage?: string;
}

export interface HeartbeatPayload {
  connectionId: string;
  terminalVersion?: string;
  openPositions?: number;
  sentAt: string;
}

export interface PositionSnapshot {
  ticket: string;
  symbol: string;
  direction: CopierDirection;
  volumeLots: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
}
