/**
 * @file backend/src/routes/tenant.ts
 * @description Tenant-scoped API routes for audit logs, usage metering, and profile data.
 * Isolated by tenant_id — Super Admins must impersonate to access these endpoints.
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { requireTenantContext, getTenantId } from '../middleware/tenant';
import { validateLicense } from '../middleware/license';
import prisma from '../db';
import { METERED_EVENT_TYPES } from '@workspace/shared/constants';

export const tenantRouter = Router();

tenantRouter.use(validateLicense);
tenantRouter.use(requireTenantContext);

/**
 * GET /api/tenant/profile
 * Returns the current tenant license and quota summary.
 */
tenantRouter.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req)!;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            lpDestinations: true,
            routingRules: true,
            symbolMappings: true,
          },
        },
      },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const volumeAggregate = await prisma.auditLog.aggregate({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
        eventType: { in: [...METERED_EVENT_TYPES] },
      },
      _sum: { volumeLots: true },
    });

    const currentLots = volumeAggregate._sum.volumeLots ? Number(volumeAggregate._sum.volumeLots) : 0;
    const limitLots = Number(tenant.monthlyVolumeLimitLots);

    res.status(200).json({
      id: tenant.id,
      companyName: tenant.companyName,
      email: tenant.email,
      licenseKey: tenant.licenseKey,
      status: tenant.status,
      licenseExpiresAt: tenant.licenseExpiresAt,
      maxDestinations: tenant.maxDestinations,
      activeDestinations: tenant._count.lpDestinations,
      activeRules: tenant._count.routingRules,
      symbolMappings: tenant._count.symbolMappings,
      monthlyVolumeLimitLots: limitLots,
      currentMonthLots: currentLots,
      utilizationPercent: limitLots > 0 ? parseFloat(((currentLots / limitLots) * 100).toFixed(2)) : 0,
    });
  } catch (error) {
    console.error('[TENANT_PROFILE_ERROR]', error);
    res.status(500).json({ error: 'Failed to load tenant profile' });
  }
});

/**
 * GET /api/tenant/metering
 * Returns live monthly volume usage for the quota bar in the dashboard header.
 */
tenantRouter.get('/metering', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req)!;

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const volumeAggregate = await prisma.auditLog.aggregate({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
        eventType: { in: [...METERED_EVENT_TYPES] },
      },
      _sum: { volumeLots: true },
    });

    const current = volumeAggregate._sum.volumeLots ? Number(volumeAggregate._sum.volumeLots) : 0;
    const limit = Number(tenant.monthlyVolumeLimitLots);

    res.status(200).json({
      current,
      limit,
      percent: limit > 0 ? Math.min(100, parseFloat(((current / limit) * 100).toFixed(2))) : 0,
      status: tenant.status,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve metering data' });
  }
});

/**
 * GET /api/tenant/audit-logs
 * Paginated tenant-scoped execution and audit logs for the dashboard feed.
 */
tenantRouter.get('/audit-logs', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req)!;
  const { page = '1', limit = '20' } = req.query;
  const pageInt = parseInt(page as string, 10);
  const limitInt = parseInt(limit as string, 10);

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { tenantId },
        skip: (pageInt - 1) * limitInt,
        take: limitInt,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where: { tenantId } }),
    ]);

    res.status(200).json({
      logs: logs.map((l) => ({ ...l, id: l.id.toString() })),
      total,
      page: pageInt,
      totalPages: Math.ceil(total / limitInt),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tenant audit logs' });
  }
});

/**
 * GET /api/tenant/broadcast
 * Returns the latest system-wide broadcast banner for this tenant dashboard.
 */
tenantRouter.get('/broadcast', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const broadcast = await prisma.auditLog.findFirst({
      where: { eventType: 'SYSTEM_BROADCAST' },
      orderBy: { createdAt: 'desc' },
    });

    if (broadcast?.metadata && typeof broadcast.metadata === 'object') {
      const meta = broadcast.metadata as Record<string, unknown>;
      res.status(200).json({ text: meta.broadcast ?? null, createdAt: broadcast.createdAt });
      return;
    }

    res.status(200).json({ text: null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load broadcast' });
  }
});
