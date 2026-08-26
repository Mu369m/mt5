/**
 * @file mt-bridge/src/execution-router.ts
 * @description Single-brain dual-pipeline router. Simulation delegates to the
 * existing engine; live mode uses an explicitly registered broker adapter and TTL safety.
 */

import type { ExecutionCommand, ExecutionPipelineMode } from '@workspace/shared';
import { executeWithSafety, type ExecutionAdapter, type ExecutionResponse } from './execution-safety';

export interface ExecutionRouter {
  execute(command: ExecutionCommand, mode: ExecutionPipelineMode): Promise<ExecutionResponse>;
}

export class DualPipelineExecutionRouter implements ExecutionRouter {
  constructor(
    private readonly simulatedExecutor: (command: ExecutionCommand) => Promise<ExecutionResponse>,
    private readonly liveAdapter?: ExecutionAdapter,
  ) {}

  async execute(command: ExecutionCommand, mode: ExecutionPipelineMode): Promise<ExecutionResponse> {
    if (mode === 'SIMULATED') return this.simulatedExecutor(command);
    if (!this.liveAdapter) throw new Error('LIVE mode requires a registered broker execution adapter');
    return executeWithSafety(command, this.liveAdapter);
  }
}
