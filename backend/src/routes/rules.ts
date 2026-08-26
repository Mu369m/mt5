/**
 * @file backend/src/routes/rules.ts
 * @description API router for Group-to-Destination routing rules. Enforces tenant partitioning
 * on all CRUD operations.
 * 
 * Connected Modules:
 * - backend/src/server.ts (registers routes)
 * - backend/src/middleware/auth.ts (enforces tenant authentication)
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { validateLicense } from '../middleware/license';
import prisma from '../db';

export const rulesRouter = Router();

// Apply licensing checks and authentication to all rule endpoints
rulesRouter.use(validateLicense);

/**
 * GET /api/rules
 * Retrieve routing matrix rules configured for this tenant.
 */
rulesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId!;

  try {
    const list = await prisma.routingRule.findMany({
      where: { tenantId },
      include: {
        destination: {
          select: {
            accountLabel: true,
            brokerName: true,
          },
        },
      },
      orderBy: { priority: 'desc' },
    });
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve routing rules' });
  }
});

/**
 * POST /api/rules
 * Insert a routing matrix definition.
 */
rulesRouter.post('/', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user!.tenantId!;
  const {
    destinationId,
    ruleName,
    sourceMt5Group,
    executionMode,
    priority,
    isEnabled,
    minLot,
    maxLot,
    forceMt5Flags,
  } = req.body;

  if (!destinationId || !ruleName || !sourceMt5Group) {
    res.status(400).json({ error: 'Destination, Rule Name and Source MT5 Group are required' });
    return;
  }

  try {
    // Confirm destination belongs to the same tenant
    const dest = await prisma.lpDestination.findFirst({
      where: { id: destinationId, tenantId },
    });

    if (!dest) {
      res.status(404).json({ error: 'Target connection destination not found' });
      return;
    }

    const rule = await prisma.routingRule.create({
      data: {
        tenantId,
        destinationId,
        ruleName,
        sourceMt5Group,
        executionMode: executionMode || 'COPIER',
        priority: priority ? parseInt(priority) : 1,
        isEnabled: isEnabled !== false,
        minLot: minLot ? parseFloat(minLot) : 0.01,
        maxLot: maxLot ? parseFloat(maxLot) : 100.0,
        forceMt5Flags: forceMt5Flags ? parseInt(forceMt5Flags) : 0,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        destinationId,
        eventType: 'RULE_CREATE',
        logLevel: 'INFO',
        message: `Tenant created routing rule "${ruleName}" mapping group "${sourceMt5Group}" to "${dest.accountLabel}"`,
      },
    });

    res.status(201).json(rule);
  } catch (error) {
    console.error('[RULES_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to insert routing rule' });
  }
});

/**
 * PUT /api/rules/:id
 * Edit details of a routing matrix rule.
 */
rulesRouter.put('/:id', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user!.tenantId!;
  const { id } = req.params;
  const {
    destinationId,
    ruleName,
    sourceMt5Group,
    executionMode,
    priority,
    isEnabled,
    minLot,
    maxLot,
    forceMt5Flags,
  } = req.body;

  try {
    const existing = await prisma.routingRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Routing rule not found or ownership denied' });
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

    const updated = await prisma.routingRule.update({
      where: { id },
      data: {
        destinationId,
        ruleName,
        sourceMt5Group,
        executionMode,
        priority: priority ? parseInt(priority) : undefined,
        isEnabled,
        minLot: minLot ? parseFloat(minLot) : undefined,
        maxLot: maxLot ? parseFloat(maxLot) : undefined,
        forceMt5Flags: forceMt5Flags ? parseInt(forceMt5Flags) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        destinationId: updated.destinationId,
        eventType: 'RULE_UPDATE',
        logLevel: 'INFO',
        message: `Tenant updated routing rule: "${updated.ruleName}"`,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update routing rule configuration' });
  }
});

/**
 * DELETE /api/rules/:id
 * Remove a routing matrix rule.
 */
rulesRouter.delete('/:id', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user!.tenantId!;
  const { id } = req.params;

  try {
    const existing = await prisma.routingRule.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Routing rule not found or ownership denied' });
      return;
    }

    await prisma.routingRule.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        eventType: 'RULE_DELETE',
        logLevel: 'WARN',
        message: `Tenant deleted routing rule: "${existing.ruleName}"`,
      },
    });

    res.status(200).json({ message: 'Routing rule deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete routing rule' });
  }
});
