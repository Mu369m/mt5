/**
 * @file backend/src/routes/policies.ts
 * @description API router managing risk execution policies, delay timers, and slippage controls.
 * Enforces tenant data isolation.
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

export const policiesRouter = Router();

// Apply licensing checks and authentication
policiesRouter.use(validateLicense);
policiesRouter.use(requireTenantContext);

/**
 * GET /api/policies
 * Fetch risk execution policies configured for this tenant.
 */
policiesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req)!;

  try {
    const list = await prisma.executionPolicy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve execution risk policies' });
  }
});

/**
 * POST /api/policies
 * Define a new execution slippage and artificial delay risk policy.
 */
policiesRouter.post('/', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const {
    policyName,
    addedLatencyOpenMs,
    addedLatencyCloseMs,
    requoteDelayMs,
    maxDeviationPoints,
    goodPriceWindowPoints,
    badPriceWindowPoints,
    isActive,
  } = req.body;

  if (!policyName) {
    res.status(400).json({ error: 'Policy Name is a mandatory attribute' });
    return;
  }

  try {
    // If setting active, deactivate existing ones first to ensure only 1 active policy
    if (isActive !== false) {
      await prisma.executionPolicy.updateMany({
        where: { tenantId, isActive: true },
        data: { isActive: false },
      });
    }

    const policy = await prisma.executionPolicy.create({
      data: {
        tenantId,
        policyName,
        addedLatencyOpenMs: addedLatencyOpenMs ? parseInt(addedLatencyOpenMs) : 0,
        addedLatencyCloseMs: addedLatencyCloseMs ? parseInt(addedLatencyCloseMs) : 0,
        requoteDelayMs: requoteDelayMs ? parseInt(requoteDelayMs) : 0,
        maxDeviationPoints: maxDeviationPoints ? parseInt(maxDeviationPoints) : 20,
        goodPriceWindowPoints: goodPriceWindowPoints ? parseInt(goodPriceWindowPoints) : 5,
        badPriceWindowPoints: badPriceWindowPoints ? parseInt(badPriceWindowPoints) : 15,
        isActive: isActive !== false,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        eventType: 'POLICY_CREATE',
        logLevel: 'INFO',
        message: `Tenant defined new execution policy "${policyName}" (Active: ${policy.isActive})`,
      },
    });

    res.status(201).json(policy);
  } catch (error) {
    console.error('[POLICIES_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to create execution policy' });
  }
});

/**
 * PUT /api/policies/:id
 * Modify details of an execution risk policy.
 */
policiesRouter.put('/:id', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const id = String(req.params.id);
  const {
    policyName,
    addedLatencyOpenMs,
    addedLatencyCloseMs,
    requoteDelayMs,
    maxDeviationPoints,
    goodPriceWindowPoints,
    badPriceWindowPoints,
    isActive,
  } = req.body;

  try {
    const existing = await prisma.executionPolicy.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Execution policy not found or ownership denied' });
      return;
    }

    // If updating to active, deactivate other policies
    if (isActive === true && !existing.isActive) {
      await prisma.executionPolicy.updateMany({
        where: { tenantId, id: { not: id }, isActive: true },
        data: { isActive: false },
      });
    }

    const updated = await prisma.executionPolicy.update({
      where: { id },
      data: {
        policyName,
        addedLatencyOpenMs: addedLatencyOpenMs ? parseInt(addedLatencyOpenMs) : undefined,
        addedLatencyCloseMs: addedLatencyCloseMs ? parseInt(addedLatencyCloseMs) : undefined,
        requoteDelayMs: requoteDelayMs ? parseInt(requoteDelayMs) : undefined,
        maxDeviationPoints: maxDeviationPoints ? parseInt(maxDeviationPoints) : undefined,
        goodPriceWindowPoints: goodPriceWindowPoints ? parseInt(goodPriceWindowPoints) : undefined,
        badPriceWindowPoints: badPriceWindowPoints ? parseInt(badPriceWindowPoints) : undefined,
        isActive,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        eventType: 'POLICY_UPDATE',
        logLevel: 'INFO',
        message: `Tenant updated execution policy details for: "${updated.policyName}"`,
      },
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update execution policy configuration' });
  }
});

/**
 * DELETE /api/policies/:id
 * Delete an execution policy configuration.
 */
policiesRouter.delete('/:id', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const id = String(req.params.id);

  try {
    const existing = await prisma.executionPolicy.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Execution policy not found or ownership denied' });
      return;
    }

    await prisma.executionPolicy.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        eventType: 'POLICY_DELETE',
        logLevel: 'WARN',
        message: `Tenant deleted execution policy: "${existing.policyName}"`,
      },
    });

    res.status(200).json({ message: 'Execution policy deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete execution policy' });
  }
});

/**
 * POST /api/policies/kill-switch
 * Emergency tenant kill-switch: disables all LP forwarding instantly.
 */
policiesRouter.post('/kill-switch', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const { active } = req.body;

  try {
    const suspend = active === false;

    if (suspend) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'SUSPENDED' },
      });
      await prisma.lpDestination.updateMany({
        where: { tenantId },
        data: { enableForwarding: false },
      });
    } else {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE' },
      });
    }

    await prisma.auditLog.create({
      data: {
        tenantId,
        eventType: 'KILL_SWITCH',
        logLevel: suspend ? 'CRITICAL' : 'INFO',
        message: suspend
          ? 'Tenant emergency kill-switch activated — all order forwarding frozen'
          : 'Tenant kill-switch released — routing re-enabled',
      },
    });

    res.status(200).json({ killSwitchActive: suspend, message: suspend ? 'Routing frozen' : 'Routing active' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle emergency kill-switch' });
  }
});
