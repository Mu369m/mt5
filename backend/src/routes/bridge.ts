/**
 * @file backend/src/routes/bridge.ts
 * @description Bridge routing API — resolves group rules to destinations and dispatches orders.
 * Applies smart LP selection, license checks, and usage metering.
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { requireTenantContext, getTenantId } from '../middleware/tenant';
import { validateLicense } from '../middleware/license';
import prisma from '../db';
import { trackUsageVolume } from '../metering';
import { resolveDestinationForGroup } from '../../../mt-bridge/src/router';
import { executeTradeRoutingPipeline } from '../../../mt-bridge/src/engine';

export const bridgeRouter = Router();

bridgeRouter.use(validateLicense);
bridgeRouter.use(requireTenantContext);

/**
 * POST /api/bridge/route
 * Route an order using group rules matrix (auto-selects destination by priority).
 */
bridgeRouter.post('/route', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const { sourceGroup, symbol, orderType, lots, price } = req.body;

  if (!sourceGroup || !symbol || !orderType || !lots) {
    res.status(400).json({ error: 'sourceGroup, symbol, orderType, and lots are required' });
    return;
  }

  const requestedLots = parseFloat(lots);
  if (isNaN(requestedLots) || requestedLots <= 0) {
    res.status(400).json({ error: 'Lots must be a positive number' });
    return;
  }

  try {
    const resolution = await resolveDestinationForGroup(tenantId, sourceGroup, requestedLots, symbol);

    if (!resolution) {
      res.status(404).json({ error: `No active routing rule found for group "${sourceGroup}"` });
      return;
    }

    const orderResult = await executeTradeRoutingPipeline({
      tenantId,
      destinationId: resolution.destinationId,
      sourceGroup,
      symbol,
      orderType,
      lots: requestedLots,
      price: price ? parseFloat(price) : undefined,
    });

    if (orderResult.success) {
      await trackUsageVolume(tenantId, requestedLots);
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        destinationId: resolution.destinationId,
        eventType: 'TRADE_EXECUTION',
        logLevel: orderResult.success ? 'INFO' : 'ERROR',
        sourceGroup,
        symbol,
        volumeLots: requestedLots,
        executionLatencyMs: orderResult.executionLatencyMs,
        message: `Group route ${orderType} ${requestedLots.toFixed(2)} lots ${symbol} via rule "${resolution.ruleName}" — ${orderResult.success ? 'FILLED' : 'REJECTED'}`,
        metadata: {
          orderId: orderResult.orderId,
          ruleId: resolution.ruleId,
          fillPrice: orderResult.fillPrice,
          requestedPrice: orderResult.requestedPrice,
          isNettedInternally: orderResult.isNettedInternally,
          isNewsShieldActive: orderResult.isNewsShieldActive,
          isToxicBotDetected: orderResult.isToxicBotDetected,
        },
      },
    });

    res.status(200).json({
      ...orderResult,
      matchedRule: resolution.ruleName,
      destinationId: resolution.destinationId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Routing failed';
    res.status(500).json({ error: message });
  }
});
