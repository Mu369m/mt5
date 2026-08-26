/**
 * @file mt-bridge/src/adapters.ts
 * @description Adapter boundaries for Master/Slave MT4 and MT5 terminals.
 * The default implementation is intentionally unavailable until a broker terminal
 * connects; no fake live fills are produced by the copier layer.
 */

import type { CopierPlatform, CopierTradeEvent, PositionSnapshot } from '@workspace/shared';

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
