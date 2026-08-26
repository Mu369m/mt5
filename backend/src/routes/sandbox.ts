/**
 * @file backend/src/routes/sandbox.ts
 * @description API router for the Order Sandbox Test Panel. Dispatches test trades directly
 * to the execution engine simulator and measures real-time execution roundtrip performance.
 * 
 * Connected Modules:
 * - backend/src/server.ts (registers routes)
 * - mt-bridge/src/engine.ts (processes orders)
 * - backend/src/metering.ts (meters usage post-execution)
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { validateLicense } from '../middleware/license';
import { trackUsageVolume } from '../metering';
import prisma from '../db';

// We import the execution router from mt-bridge using its direct relative path
import { executeTradeRoutingPipeline } from '../../../mt-bridge/src/engine';

export const sandboxRouter = Router();

// Apply licensing checks and authentication to the sandbox
sandboxRouter.use(validateLicense);

/**
 * POST /api/sandbox/execute
 * Dispatch a manual sandbox test order and return latency diagnostics (in ms).
 */
sandboxRouter.post('/execute', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user!.tenantId!;
  const { destinationId, symbol, orderType, lots, price } = req.body;

  if (!destinationId || !symbol || !orderType || !lots) {
    res.status(400).json({ error: 'Missing mandatory test trade fields' });
    return;
  }

  const requestedLots = parseFloat(lots);
  if (isNaN(requestedLots) || requestedLots <= 0) {
    res.status(400).json({ error: 'Lots size must be a positive number' });
    return;
  }

  const startTime = Date.now();

  try {
    // 1. Confirm target destination exists and belongs to this tenant
    const dest = await prisma.lpDestination.findFirst({
      where: { id: destinationId, tenantId },
    });

    if (!dest) {
      res.status(404).json({ error: 'Selected destination not found or access denied' });
      return;
    }

    if (!dest.enableForwarding) {
      res.status(400).json({ error: 'Order forwarding is disabled for this destination' });
      return;
    }

    // 2. Lookup user's group name (simulate group targeting from user headers or default)
    const sourceGroup = 'SANDBOX\\TEST_GROUP';

    // 3. Dispatch to mt-bridge pipeline
    const orderResult = await executeTradeRoutingPipeline({
      tenantId,
      destinationId,
      sourceGroup,
      symbol,
      orderType,
      lots: requestedLots,
      price: price ? parseFloat(price) : undefined,
    });

    const roundtripLatency = Date.now() - startTime;

    // 4. Update real-time usage meters for billing
    if (orderResult.success) {
      await trackUsageVolume(tenantId, requestedLots);
    }

    // Write to audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        destinationId,
        eventType: 'SANDBOX_ORDER',
        logLevel: orderResult.success ? 'INFO' : 'ERROR',
        sourceGroup,
        symbol,
        volumeLots: requestedLots,
        executionLatencyMs: orderResult.executionLatencyMs,
        message: `Sandbox ${orderType} ${requestedLots.toFixed(2)} lots of ${symbol} on ${dest.accountLabel} - Status: ${orderResult.success ? 'SUCCESS' : 'FAILED'}. Internal Overheads: ${roundtripLatency - orderResult.executionLatencyMs}ms. Details: ${orderResult.errorMessage || 'Order Filled'}`,
        metadata: {
          requestedPrice: price,
          fillPrice: orderResult.fillPrice,
          pipelineLatencyMs: orderResult.executionLatencyMs,
          totalApiLatencyMs: roundtripLatency,
          lotsDivisorUsed: dest.lotsDivisor.toString(),
        },
      },
    });

    res.status(200).json({
      ...orderResult,
      totalApiLatencyMs: roundtripLatency,
    });
  } catch (error: any) {
    console.error('[SANDBOX_EXECUTION_ERROR]', error);
    res.status(500).json({ error: 'Sandbox order pipeline simulation failed: ' + error.message });
  }
});
