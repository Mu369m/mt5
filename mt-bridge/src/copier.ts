/**
 * @file mt-bridge/src/copier.ts
 * @description Master-to-Slave lifecycle dispatcher with idempotency, heartbeat
 * tracking, volume scaling, symbol resolution, and explicit adapter boundaries.
 */

import type {
  CopierConnectionStatus,
  CopierDispatchResult,
  CopierTradeEvent,
  HeartbeatPayload,
  PositionSnapshot,
} from '@workspace/shared';
import type { SlaveAdapter } from './adapters';

interface ConnectionState {
  status: CopierConnectionStatus;
  lastHeartbeatAt: string | null;
  terminalVersion?: string;
}

const connections = new Map<string, ConnectionState>();
const adapters = new Map<string, SlaveAdapter>();
const masterEvents = new Set<string>();

export function registerSlaveAdapter(adapter: SlaveAdapter): void {
  adapters.set(adapter.connectionId, adapter);
  connections.set(adapter.connectionId, { status: 'OFFLINE', lastHeartbeatAt: null });
}

export function unregisterSlaveAdapter(connectionId: string): void {
  adapters.delete(connectionId);
  connections.delete(connectionId);
}

export function recordHeartbeat(payload: HeartbeatPayload): ConnectionState {
  const state: ConnectionState = {
    status: 'ONLINE',
    lastHeartbeatAt: payload.sentAt,
    terminalVersion: payload.terminalVersion,
  };
  connections.set(payload.connectionId, state);
  return state;
}

export function getConnectionState(connectionId: string): ConnectionState | null {
  return connections.get(connectionId) ?? null;
}

export function markStaleConnections(maxAgeMs = 15_000): void {
  const cutoff = Date.now() - maxAgeMs;
  for (const state of connections.values()) {
    if (!state.lastHeartbeatAt || Date.parse(state.lastHeartbeatAt) < cutoff) {
      state.status = 'OFFLINE';
    }
  }
}

/**
 * Dispatch one normalized master event to a connected slave adapter.
 * Duplicate event IDs are acknowledged without executing twice.
 */
export async function dispatchCopierEvent(
  event: CopierTradeEvent,
  slaveConnectionId: string,
  volumeMultiplier = 1,
  symbolResolver: (symbol: string) => string = (symbol) => symbol,
): Promise<CopierDispatchResult> {
  const startedAt = Date.now();
  if (masterEvents.has(event.eventId)) {
    return { eventId: event.eventId, status: 'DUPLICATE', slaveConnectionId, latencyMs: 0 };
  }

  const adapter = adapters.get(slaveConnectionId);
  if (!adapter) {
    return {
      eventId: event.eventId,
      status: 'FAILED',
      slaveConnectionId,
      latencyMs: Date.now() - startedAt,
      errorMessage: 'Slave connection is not registered',
    };
  }

  const scaledVolume = event.volumeLots ? event.volumeLots * volumeMultiplier : undefined;
  try {
    let slaveTicket: string | undefined;
    const symbol = symbolResolver(event.symbol);
    if (event.eventType === 'ORDER_OPEN' || event.eventType === 'PENDING_TRIGGER') {
      if (!scaledVolume || scaledVolume <= 0) throw new Error('Event volume must be positive');
      slaveTicket = await adapter.openPosition(event, scaledVolume, symbol);
    } else if (event.eventType === 'ORDER_MODIFY') {
      if (!event.masterTicket) throw new Error('Master ticket is required for modification');
      await adapter.modifyPosition(event, event.masterTicket);
    } else {
      if (!event.masterTicket) throw new Error('Master ticket is required for close');
      await adapter.closePosition(event, event.masterTicket, event.closeVolumeLots);
    }

    masterEvents.add(event.eventId);
    return {
      eventId: event.eventId,
      status: 'APPLIED',
      slaveConnectionId,
      slaveTicket,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      eventId: event.eventId,
      status: 'FAILED',
      slaveConnectionId,
      latencyMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : 'Slave dispatch failed',
    };
  }
}

export async function reconcilePositions(
  slaveConnectionId: string,
  expected: PositionSnapshot[],
): Promise<{ matched: number; missing: PositionSnapshot[] }> {
  const adapter = adapters.get(slaveConnectionId);
  if (!adapter) throw new Error('Slave connection is not registered');
  const actual = await adapter.snapshot();
  const actualKeys = new Set(actual.map((position) => `${position.symbol}:${position.direction}:${position.volumeLots}`));
  const missing = expected.filter((position) => !actualKeys.has(`${position.symbol}:${position.direction}:${position.volumeLots}`));
  return { matched: expected.length - missing.length, missing };
}
