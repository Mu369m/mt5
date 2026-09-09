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

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Symbol mapping payload is required' });
    return;
  }

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

  if (typeof destinationId !== 'string' || !destinationId.trim() || typeof sourceSymbol !== 'string' || !sourceSymbol.trim() || typeof destinationSymbol !== 'string' || !destinationSymbol.trim()) {
    res.status(400).json({ error: 'Destination, Source Symbol, and Destination Symbol are required' });
    return;
  }

  try {
    // Confirm destination belongs to the same tenant
    const dest = await prisma.lpDestination.findFirst({
      where: { id: destinationId.trim(), tenantId },
    });

    if (!dest) {
      res.status(404).json({ error: 'Connection destination not found or ownership denied' });
      return;
    }

    // Check if unique constraint is violated: UNIQUE (tenant_id, destination_id, source_symbol)
    const existing = await prisma.symbolMapping.findFirst({
      where: { tenantId, destinationId: destinationId.trim(), sourceSymbol: sourceSymbol.trim() },
    });

    if (existing) {
      res.status(409).json({
        error: `A mapping for symbol "${sourceSymbol.trim()}" on destination "${dest.accountLabel}" already exists.`,
      });
      return;
    }

    const mapping = await prisma.symbolMapping.create({
      data: {
        tenantId,
        destinationId: destinationId.trim(),
        sourceSymbol: sourceSymbol.trim(),
        destinationSymbol: destinationSymbol.trim(),
        markupPoints: typeof markupPoints === 'string' && markupPoints.trim() ? parseFloat(markupPoints) : 0.0,
        commissionOverride: typeof commissionOverride === 'string' && commissionOverride.trim() ? parseFloat(commissionOverride) : 0.0,
        swapBuyOverride: typeof swapBuyOverride === 'string' && swapBuyOverride.trim() ? parseFloat(swapBuyOverride) : 0.0,
        swapSellOverride: typeof swapSellOverride === 'string' && swapSellOverride.trim() ? parseFloat(swapSellOverride) : 0.0,
        passSourceSpread: typeof passSourceSpread === 'boolean' ? passSourceSpread : true,
        passFillPrice: typeof passFillPrice === 'boolean' ? passFillPrice : false,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        destinationId: destinationId.trim(),
        eventType: 'SYMBOL_MAP_CREATE',
        logLevel: 'INFO',
        message: `Tenant registered translation mapping: "${sourceSymbol.trim()}" -> "${destinationSymbol.trim()}" with markup ${typeof markupPoints === 'string' && markupPoints.trim() ? parseFloat(markupPoints) : 0} pts`,
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

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Symbol mapping update payload is required' });
    return;
  }

  const id = String(req.params.id);
  if (typeof id !== 'string' || !id.trim()) {
    res.status(400).json({ error: 'Symbol mapping id is required' });
    return;
  }

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

    if (typeof destinationId === 'string' && destinationId.trim()) {
      const dest = await prisma.lpDestination.findFirst({
        where: { id: destinationId.trim(), tenantId },
      });
      if (!dest) {
        res.status(404).json({ error: 'Target connection destination not found' });
        return;
      }
    }

    const updated = await prisma.symbolMapping.update({
      where: { id },
      data: {
        destinationId: typeof destinationId === 'string' && destinationId.trim() ? destinationId.trim() : undefined,
        sourceSymbol: typeof sourceSymbol === 'string' && sourceSymbol.trim() ? sourceSymbol.trim() : undefined,
        destinationSymbol: typeof destinationSymbol === 'string' && destinationSymbol.trim() ? destinationSymbol.trim() : undefined,
        markupPoints: typeof markupPoints === 'string' && markupPoints.trim() ? parseFloat(markupPoints) : undefined,
        commissionOverride: typeof commissionOverride === 'string' && commissionOverride.trim() ? parseFloat(commissionOverride) : undefined,
        swapBuyOverride: typeof swapBuyOverride === 'string' && swapBuyOverride.trim() ? parseFloat(swapBuyOverride) : undefined,
        swapSellOverride: typeof swapSellOverride === 'string' && swapSellOverride.trim() ? parseFloat(swapSellOverride) : undefined,
        passSourceSpread: typeof passSourceSpread === 'boolean' ? passSourceSpread : undefined,
        passFillPrice: typeof passFillPrice === 'boolean' ? passFillPrice : undefined,
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

  if (typeof id !== 'string' || !id.trim()) {
    res.status(400).json({ error: 'Symbol mapping id is required' });
    return;
  }

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
