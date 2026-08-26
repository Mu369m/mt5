/**
 * @file backend/src/middleware/license.ts
 * @description Tenant isolation and active license subscription authorization validation middleware.
 * Implements a global Kill-Switch mechanism which checks tenant status, license expiry,
 * and monthly traded lot quotas before permitting API or trade gateway operations.
 * 
 * Connected Modules:
 * - backend/src/db.ts (interacts with Tenant tables)
 * - backend/src/middleware/auth.ts (retrieves AuthenticatedRequest)
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import prisma from '../db';

/**
 * Validates that the active tenant request context has a valid license subscription
 * and has not exceeded their monthly trade lot volume quotas.
 * If validation fails, instantly executes a Kill-Switch blockage.
 */
export async function validateLicense(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.user;

  // Super Admins are exempt from tenant license check restrictions
  if (user && user.role === 'SUPER_ADMIN') {
    return next();
  }

  const tenantId = user?.tenantId;
  if (!tenantId) {
    res.status(400).json({ error: 'Tenant context is missing for this transaction' });
    return;
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant profile not found' });
      return;
    }

    // 1. Check Active Status
    if (tenant.status !== 'ACTIVE') {
      res.status(403).json({
        error: `Tenant License Suspended: Status is currently ${tenant.status}`,
        licenseStatus: tenant.status,
        killSwitchTriggered: true,
      });
      return;
    }

    // 2. Check Expiry Date
    const now = new Date();
    const expiryDate = new Date(tenant.licenseExpiresAt);
    if (expiryDate <= now) {
      // Auto-expire database hook
      if (tenant.status === 'ACTIVE') {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { status: 'EXPIRED' },
        });
      }
      res.status(403).json({
        error: 'Tenant License Expired: Please contact Super Admin to renew subscription',
        licenseStatus: 'EXPIRED',
        killSwitchTriggered: true,
      });
      return;
    }

    // 3. Check Monthly Lots Volume Limit
    // Compute total traded volume for this tenant this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const volumeAggregate = await prisma.auditLog.aggregate({
      where: {
        tenantId: tenantId,
        createdAt: { gte: startOfMonth },
        eventType: { in: ['ORDER_FILL', 'TRADE_EXECUTION', 'SANDBOX_ORDER'] },
      },
      _sum: {
        volumeLots: true,
      },
    });

    const currentLotsTraded = volumeAggregate._sum.volumeLots ? Number(volumeAggregate._sum.volumeLots) : 0;
    const limitLots = Number(tenant.monthlyVolumeLimitLots);

    if (currentLotsTraded >= limitLots) {
      res.status(403).json({
        error: `Monthly volume limit exceeded (${currentLotsTraded.toFixed(2)} / ${limitLots.toFixed(2)} lots). Order routing disabled.`,
        currentLots: currentLotsTraded,
        limitLots: limitLots,
        killSwitchTriggered: true,
      });
      return;
    }

    // Tenant context verified successfully
    next();
  } catch (error: any) {
    console.error('[LICENSE_MIDDLEWARE_ERROR]', error);
    res.status(500).json({ error: 'Internal license verification error' });
  }
}
