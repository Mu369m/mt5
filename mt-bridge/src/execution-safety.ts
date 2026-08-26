/**
 * @file mt-bridge/src/execution-safety.ts
 * @description TTL enforcement, timeout cancellation, rollback hooks, and deviation
 * checks for live broker adapters. Adapters remain responsible for broker APIs.
 */

import type { ExecutionCommand } from '@workspace/shared';

export interface ExecutionResponse {
  filled: boolean;
  fillPrice?: number;
  filledVolumeLots?: number;
  slippagePoints?: number;
}

export interface ExecutionAdapter {
  execute(command: ExecutionCommand): Promise<ExecutionResponse>;
  cancel(command: ExecutionCommand): Promise<void>;
  rollback(command: ExecutionCommand): Promise<void>;
}

function timeoutAfter<T>(promise: Promise<T>, ttlMs: number): Promise<T> {
  const safeTtl = Math.min(Math.max(Math.floor(ttlMs), 1), 10_000);
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Execution TTL expired after ${safeTtl}ms`)), safeTtl)),
  ]);
}

export async function executeWithSafety(command: ExecutionCommand, adapter: ExecutionAdapter): Promise<ExecutionResponse> {
  try {
    const response = await timeoutAfter(adapter.execute(command), command.ttlMs);
    if (!response.filled) throw new Error('Broker returned no fill confirmation');
    if ((response.slippagePoints ?? 0) > command.maxDeviationPoints) {
      await adapter.cancel(command);
      throw new Error(`Fill deviation exceeded ${command.maxDeviationPoints} points`);
    }
    return response;
  } catch (error) {
    try { await adapter.cancel(command); } catch { /* cancellation is best effort after a timeout */ }
    try { await adapter.rollback(command); } catch { /* rollback is best effort and must not hide original failure */ }
    throw error;
  }
}
