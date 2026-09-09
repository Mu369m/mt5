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
import { requireTenantContext, getTenantId } from '../middleware/tenant';
import prisma from '../db';

export const rulesRouter = Router();

// Apply licensing checks and authentication to all rule endpoints
rulesRouter.use(validateLicense);
rulesRouter.use(requireTenantContext);

/**
 * GET /api/rules
 * Retrieve routing matrix rules configured for this tenant.
 */
rulesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req)!;

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
  const tenantId = getTenantId(req)!;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Routing rule payload is required' });
    return;
  }

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

  if (typeof destinationId !== 'string' || !destinationId.trim() || typeof ruleName !== 'string' || !ruleName.trim() || typeof sourceMt5Group !== 'string' || !sourceMt5Group.trim()) {
    res.status(400).json({ error: 'Destination, Rule Name and Source MT5 Group are required' });
    return;
  }

  try {
    // Confirm destination belongs to the same tenant
    const dest = await prisma.lpDestination.findFirst({
      where: { id: destinationId.trim(), tenantId },
    });

    if (!dest) {
      res.status(404).json({ error: 'Target connection destination not found' });
      return;
    }

    const rule = await prisma.routingRule.create({
      data: {
        tenantId,
        destinationId: destinationId.trim(),
        ruleName: ruleName.trim(),
        sourceMt5Group: sourceMt5Group.trim(),
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
        destinationId: destinationId.trim(),
        eventType: 'RULE_CREATE',
        logLevel: 'INFO',
        message: `Tenant created routing rule "${ruleName.trim()}" mapping group "${sourceMt5Group.trim()}" to "${dest.accountLabel}"`,
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
  const tenantId = getTenantId(req)!;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Routing rule update payload is required' });
    return;
  }

  const id = String(req.params.id);
  if (typeof id !== 'string' || !id.trim()) {
    res.status(400).json({ error: 'Routing rule id is required' });
    return;
  }

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

    if (typeof destinationId === 'string' && destinationId.trim()) {
      const dest = await prisma.lpDestination.findFirst({
        where: { id: destinationId.trim(), tenantId },
      });
      if (!dest) {
        res.status(404).json({ error: 'Target connection destination not found' });
        return;
      }
    }

    const executionModeValue = executionMode === 'COPIER' || executionMode === 'DEALER_ONLY' ? executionMode : undefined;

    const updated = await prisma.routingRule.update({
      where: { id },
      data: {
        destinationId: typeof destinationId === 'string' && destinationId.trim() ? destinationId.trim() : undefined,
        ruleName: typeof ruleName === 'string' && ruleName.trim() ? ruleName.trim() : undefined,
        sourceMt5Group: typeof sourceMt5Group === 'string' && sourceMt5Group.trim() ? sourceMt5Group.trim() : undefined,
        executionMode: executionModeValue,
        priority: typeof priority === 'string' && priority.trim() ? parseInt(priority) : undefined,
        isEnabled: typeof isEnabled === 'boolean' ? isEnabled : undefined,
        minLot: typeof minLot === 'string' && minLot.trim() ? parseFloat(minLot) : undefined,
        maxLot: typeof maxLot === 'string' && maxLot.trim() ? parseFloat(maxLot) : undefined,
        forceMt5Flags: typeof forceMt5Flags === 'string' && forceMt5Flags.trim() ? parseInt(forceMt5Flags) : undefined,
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
  const tenantId = getTenantId(req)!;
  const id = String(req.params.id);

  if (typeof id !== 'string' || !id.trim()) {
    res.status(400).json({ error: 'Routing rule id is required' });
    return;
  }

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
