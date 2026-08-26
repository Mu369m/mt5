/**
 * @file backend/src/routes/symbols.ts
 * @description API router managing symbol mapping translations and price markup offsets.
 * Enforces strict tenant data partitioning and configuration lookups.
 * 
 * Connected Modules:
 * - backend/src/server.ts (registers routes)
 * - backend/src/middleware/auth.ts (enforces tenant authentication)
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { validateLicense } from '../middleware/license';
import { requireTenantContext, getTenantId } from '../middleware/tenant';
import prisma from '../db';

export const symbolsRouter = Router();

// Apply licensing validation and authentication
symbolsRouter.use(validateLicense);
symbolsRouter.use(requireTenantContext);

/**
 * GET /api/symbols
 * Fetch active symbol mappings for this tenant.
 */
symbolsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req)!;

  try {
    const list = await prisma.symbolMapping.findMany({
      where: { tenantId },
      include: {
        destination: {
          select: {
            accountLabel: true,
            brokerName: true,
          },
        },
      },
      orderBy: { sourceSymbol: 'asc' },
    });
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve symbol mapping matrix' });
  }
});

/**
 * POST /api/symbols
 * Define a new symbol mapping translating a symbol from source MT5 to destination LP.
 */
symbolsRouter.post('/', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const {
    destinationId,
    sourceSymbol,
    destinationSymbol,
    markupPoints,
    commissionOverride,
    swapBuyOverride,
    swapSellOverride,
    passSourceSpread,
    passFillPrice,
  } = req.body;

  if (!destinationId || !sourceSymbol || !destinationSymbol) {
    res.status(400).json({ error: 'Destination, Source Symbol, and Destination Symbol are required' });
    return;
  }

  try {
    // Confirm destination belongs to the same tenant
    const dest = await prisma.lpDestination.findFirst({
      where: { id: destinationId, tenantId },
    });

    if (!dest) {
      res.status(404).json({ error: 'Connection destination not found or ownership denied' });
      return;
    }

    // Check if unique constraint is violated: UNIQUE (tenant_id, destination_id, source_symbol)
    const existing = await prisma.symbolMapping.findFirst({
      where: { tenantId, destinationId, sourceSymbol },
    });

    if (existing) {
      res.status(409).json({
        error: `A mapping for symbol "${sourceSymbol}" on destination "${dest.accountLabel}" already exists.`,
      });
      return;
    }

    const mapping = await prisma.symbolMapping.create({
      data: {
        tenantId,
        destinationId,
        sourceSymbol,
        destinationSymbol,
        markupPoints: markupPoints ? parseFloat(markupPoints) : 0.0,
        commissionOverride: commissionOverride ? parseFloat(commissionOverride) : 0.0,
        swapBuyOverride: swapBuyOverride ? parseFloat(swapBuyOverride) : 0.0,
        swapSellOverride: swapSellOverride ? parseFloat(swapSellOverride) : 0.0,
        passSourceSpread: passSourceSpread !== false,
        passFillPrice: passFillPrice === true,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        destinationId,
        eventType: 'SYMBOL_MAP_CREATE',
        logLevel: 'INFO',
        message: `Tenant registered translation mapping: "${sourceSymbol}" -> "${destinationSymbol}" with markup ${markupPoints || 0} pts`,
      },
    });

    res.status(201).json(mapping);
  } catch (error) {
    console.error('[SYMBOLS_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to define symbol translation mapping' });
  }
});

/**
 * PUT /api/symbols/:id
 * Modify spreads markup, swaps overrides, or flags.
 */
symbolsRouter.put('/:id', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const id = String(req.params.id);
  const {
    destinationId,
    sourceSymbol,
    destinationSymbol,
    markupPoints,
    commissionOverride,
    swapBuyOverride,
    swapSellOverride,
    passSourceSpread,
    passFillPrice,
  } = req.body;

  try {
    const existing = await prisma.symbolMapping.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Symbol mapping profile not found or ownership denied' });
      return;
    }

    if (destinationId) {
      const dest = await prisma.lpDestination.findFirst({
        where: { id: destinationId, tenantId },
      });
      if (!dest) {
        res.status(404).json({ error: 'Target connection destination not found' });
        return;
      }
    }

    const updated = await prisma.symbolMapping.update({
      where: { id },
      data: {
        destinationId,
        sourceSymbol,
        destinationSymbol,
        markupPoints: markupPoints ? parseFloat(markupPoints) : undefined,
        commissionOverride: commissionOverride ? parseFloat(commissionOverride) : undefined,
        swapBuyOverride: swapBuyOverride ? parseFloat(swapBuyOverride) : undefined,
        swapSellOverride: swapSellOverride ? parseFloat(swapSellOverride) : undefined,
        passSourceSpread,
        passFillPrice,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        destinationId: updated.destinationId,
        eventType: 'SYMBOL_MAP_UPDATE',
        logLevel: 'INFO',
        message: `Tenant modified markup rules for mapping: "${updated.sourceSymbol}" -> "${updated.destinationSymbol}"`,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update symbol mapping configuration' });
  }
});

/**
 * DELETE /api/symbols/:id
 * Purge symbol mapping configuration.
 */
symbolsRouter.delete('/:id', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const id = String(req.params.id);

  try {
    const existing = await prisma.symbolMapping.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Symbol mapping not found or ownership denied' });
      return;
    }

    await prisma.symbolMapping.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        eventType: 'SYMBOL_MAP_DELETE',
        logLevel: 'WARN',
        message: `Tenant deleted symbol mapping: "${existing.sourceSymbol}" -> "${existing.destinationSymbol}"`,
      },
    });

    res.status(200).json({ message: 'Symbol mapping deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to purge symbol mapping' });
  }
});
