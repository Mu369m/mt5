/**
 * @file mt-bridge/src/execution-router.ts
 * @description Single-brain dual-pipeline router. Simulation delegates to the
 * existing engine; live mode uses an explicitly registered broker adapter and TTL safety.
 */

import type { ExecutionCommand, ExecutionPipelineMode } from '@workspace/shared';
import { executeWithSafety, type ExecutionAdapter, type ExecutionResponse } from './execution-safety';
import type { TradingDestinationAdapter } from './adapters';

export interface ExecutionRouter {
  execute(command: ExecutionCommand, mode: ExecutionPipelineMode): Promise<ExecutionResponse>;
}

export function destinationAdapterToExecutionAdapter(destination: TradingDestinationAdapter): ExecutionAdapter {
  if (!destination.liveEnabled) {
    throw new Error('LIVE mode requires a registered live trading destination adapter');
  }

  return {
    execute(command: ExecutionCommand): Promise<ExecutionResponse> {
      return destination.sendMarketOrder(command);
    },
    async cancel(command: ExecutionCommand): Promise<void> {
      await destination.closeOrder(command);
    },
    async rollback(command: ExecutionCommand): Promise<void> {
      await destination.modifyOrder(command);
    },
  };
}

export class DualPipelineExecutionRouter implements ExecutionRouter {
  constructor(
    private readonly simulatedExecutor: (command: ExecutionCommand) => Promise<ExecutionResponse>,
    private readonly liveAdapter?: ExecutionAdapter,
    private readonly destinationAdapter?: TradingDestinationAdapter,
  ) {}

  async execute(command: ExecutionCommand, mode: ExecutionPipelineMode): Promise<ExecutionResponse> {
    if (mode === 'SIMULATED') return this.simulatedExecutor(command);

    if (this.destinationAdapter && this.destinationAdapter.liveEnabled) {
      return executeWithSafety(command, destinationAdapterToExecutionAdapter(this.destinationAdapter));
    }

    if (!this.liveAdapter) throw new Error('LIVE mode requires a registered broker execution adapter');
    return executeWithSafety(command, this.liveAdapter);
  }
}
