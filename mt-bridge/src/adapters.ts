/**
 * @file mt-bridge/src/adapters.ts
 * @description Adapter boundaries for Master/Slave MT4 and MT5 terminals.
 * The default implementation is intentionally unavailable until a broker terminal
 * connects; no fake live fills are produced by the copier layer.
 */

import type { CopierPlatform, CopierTradeEvent, PositionSnapshot } from '@workspace/shared';
import type { ExecutionCommand } from '@workspace/shared';
import type { ExecutionResponse } from './execution-safety';

export interface MasterAdapter {
  readonly platform: CopierPlatform;
  readonly connectionId: string;
  receiveEvent(event: CopierTradeEvent): Promise<void>;
  heartbeat(sentAt: string, terminalVersion?: string): Promise<void>;
}

export interface SlaveAdapter {
  readonly platform: CopierPlatform;
  readonly connectionId: string;
  openPosition(event: CopierTradeEvent, volumeLots: number, symbol: string): Promise<string>;
  modifyPosition(event: CopierTradeEvent, slaveTicket: string): Promise<void>;
  closePosition(event: CopierTradeEvent, slaveTicket: string, volumeLots?: number): Promise<void>;
  snapshot(): Promise<PositionSnapshot[]>;
}

/**
 * Trading destination adapter for the connector abstraction requested by the
 * project brief. Live dispatch remains disabled until an enableLive flag is
 * passed explicitly. Everything defaults to a sandbox-safe simulation path.
 */
export type TradingDestinationMode = 'SANDBOX' | 'LIVE';

export interface TradingDestinationAdapter {
  readonly mode: TradingDestinationMode;
  readonly liveEnabled: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<{ status: 'ONLINE' | 'OFFLINE' | 'DEGRADED'; latencyMs: number; }>;
  getAccountMode(): Promise<'HEDGING' | 'NETTING' | 'UNKNOWN'>;
  getSymbolInfo(symbol: string): Promise<{ symbol: string; digits: number; pipSize?: number; }>;
  sendMarketOrder(command: ExecutionCommand): Promise<ExecutionResponse>;
  sendLimitOrder(command: ExecutionCommand): Promise<ExecutionResponse>;
  closeOrder(command: ExecutionCommand): Promise<ExecutionResponse>;
  modifyOrder(command: ExecutionCommand): Promise<ExecutionResponse>;
}

/**
 * Rejects live dispatch until a concrete MT4/MT5 connector is registered.
 * This prevents a production-looking success response from hiding an absent terminal.
 */
export class UnavailableSlaveAdapter implements SlaveAdapter {
  readonly platform: CopierPlatform;

  constructor(readonly connectionId: string, platform: CopierPlatform) {
    this.platform = platform;
  }

  async openPosition(): Promise<string> {
    throw new Error('No live slave terminal adapter is connected');
  }

  async modifyPosition(): Promise<void> {
    throw new Error('No live slave terminal adapter is connected');
  }

  async closePosition(): Promise<void> {
    throw new Error('No live slave terminal adapter is connected');
  }

  async snapshot(): Promise<PositionSnapshot[]> {
    throw new Error('No live slave terminal adapter is connected');
  }
}

/**
 * Sandbox trial adapter: makes the connector contract visible without allowing
 * the live execution branch to become an implicit default. This keeps the
 * requested “paper/sandbox mode first enabled” philosophy in the codebase.
 */
export class SandboxTradingDestinationAdapter implements TradingDestinationAdapter {
  readonly mode: TradingDestinationMode = 'SANDBOX';
  readonly liveEnabled = false;
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async healthCheck(): Promise<{ status: 'ONLINE' | 'OFFLINE' | 'DEGRADED'; latencyMs: number; }> {
    return {
      status: this.connected ? 'ONLINE' : 'OFFLINE',
      latencyMs: 1,
    };
  }

  async getAccountMode(): Promise<'HEDGING' | 'NETTING' | 'UNKNOWN'> {
    return 'HEDGING';
  }

  async getSymbolInfo(symbol: string): Promise<{ symbol: string; digits: number; pipSize?: number; }> {
    const upper = symbol.toUpperCase();
    return {
      symbol: upper,
      digits: upper.includes('JPY') || upper.includes('XAU') ? 2 : 5,
      pipSize: upper.includes('JPY') ? 0.01 : 0.0001,
    };
  }

  async sendMarketOrder(command: ExecutionCommand): Promise<ExecutionResponse> {
    return {
      filled: false,
      fillPrice: 0,
      filledVolumeLots: command.volumeLots ?? 0,
      slippagePoints: 0,
    };
  }

  async sendLimitOrder(command: ExecutionCommand): Promise<ExecutionResponse> {
    return {
      filled: false,
      fillPrice: 0,
      filledVolumeLots: command.volumeLots ?? 0,
      slippagePoints: 0,
    };
  }

  async closeOrder(command: ExecutionCommand): Promise<ExecutionResponse> {
    return {
      filled: false,
      fillPrice: 0,
      filledVolumeLots: command.volumeLots ?? 0,
      slippagePoints: 0,
    };
  }

  async modifyOrder(command: ExecutionCommand): Promise<ExecutionResponse> {
    return {
      filled: false,
      fillPrice: 0,
      filledVolumeLots: command.volumeLots ?? 0,
      slippagePoints: 0,
    };
  }
}

/**
 * Convenience factory for a sandbox-safe adapter that refuses to masquerade as a
 * live bridge permission.
 */
export class UnavailableTradingDestinationAdapter implements TradingDestinationAdapter {
  readonly mode: TradingDestinationMode = 'SANDBOX';
  readonly liveEnabled = false;

  async connect(): Promise<void> {
    throw new Error('No live trading destination adapter is connected');
  }

  async disconnect(): Promise<void> {
    return;
  }

  async healthCheck(): Promise<{ status: 'ONLINE' | 'OFFLINE' | 'DEGRADED'; latencyMs: number; }> {
    return { status: 'OFFLINE', latencyMs: 0 };
  }

  async getAccountMode(): Promise<'HEDGING' | 'NETTING' | 'UNKNOWN'> {
    throw new Error('No live trading destination adapter is connected');
  }

  async getSymbolInfo(symbol: string): Promise<{ symbol: string; digits: number; pipSize?: number; }> {
    throw new Error('No live trading destination adapter is connected');
  }

  async sendMarketOrder(command: ExecutionCommand): Promise<ExecutionResponse> {
    throw new Error('No live trading destination adapter is connected');
  }

  async sendLimitOrder(command: ExecutionCommand): Promise<ExecutionResponse> {
    throw new Error('No live trading destination adapter is connected');
  }

  async closeOrder(command: ExecutionCommand): Promise<ExecutionResponse> {
    throw new Error('No live trading destination adapter is connected');
  }

  async modifyOrder(command: ExecutionCommand): Promise<ExecutionResponse> {
    throw new Error('No live trading destination adapter is connected');
  }
}

export class InMemoryTradingDestinationRegistry {
  private readonly adapters = new Map<string, TradingDestinationAdapter>();

  register(adapter: TradingDestinationAdapter, key = adapter.mode): void {
    this.adapters.set(key, adapter);
  }

  unregister(key: string): void {
    this.adapters.delete(key);
  }

  hasLiveAdapter(): boolean {
    return Array.from(this.adapters.values()).some((adapter) => adapter.liveEnabled);
  }

  getLiveAdapter(): TradingDestinationAdapter | undefined {
    const live = Array.from(this.adapters.values()).find((adapter) => adapter.liveEnabled);
    return live;
  }

  get(key: string): TradingDestinationAdapter | undefined {
    return this.adapters.get(key);
  }
}

export function createSandboxTradingDestinationAdapter(): TradingDestinationAdapter {
  return new SandboxTradingDestinationAdapter();
}

export function createUnavailableTradingDestinationAdapter(): TradingDestinationAdapter {
  return new UnavailableTradingDestinationAdapter();
}

export function createTradingDestinationRegistry(): InMemoryTradingDestinationRegistry {
  return new InMemoryTradingDestinationRegistry();
}
