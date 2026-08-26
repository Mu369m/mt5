/**
 * @file backend/src/routes/destinations.ts
 * @description API router for LP Destination Accounts. Enforces tenant-isolation and
 * max license destinations limits. Password fields are AES-256 encrypted before write.
 * 
 * Connected Modules:
 * - backend/src/server.ts (registers routes)
 * - backend/src/middleware/auth.ts (enforces tenant authentication)
 * - backend/src/utils/crypto.ts (symmetric password encrypter)
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { validateLicense } from '../middleware/license';
import { encrypt } from '../utils/crypto';
import prisma from '../db';

export const destinationsRouter = Router();

// Apply licensing and tenant role validations to all endpoints
destinationsRouter.use(validateLicense);

/**
 * GET /api/destinations
 * List all destinations configured for the authenticated tenant.
 */
destinationsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId!;

  try {
    const list = await prisma.lpDestination.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    // Remove encrypted password hashes from list response for security
    const sanitized = list.map(d => {
      const { encryptedPassword, ...rest } = d;
      return rest;
    });
    res.status(200).json(sanized);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve destination profiles' });
  }
});

/**
 * POST /api/destinations
 * Add a new LP or MT5 target account.
 */
destinationsRouter.post('/', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user!.tenantId!;
  const {
    brokerName,
    accountLabel,
    serverIp,
    port,
    loginId,
    password,
    accountMode,
    enableForwarding,
    deviationPt,
    magicId,
    lotsDivisor,
    destDealerWaitMs,
  } = req.body;

  if (!brokerName || !accountLabel || !serverIp || !port || !loginId || !password) {
    res.status(400).json({ error: 'Missing mandatory account connection fields' });
    return;
  }

  try {
    // 1. Enforce licensing limit check
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { _count: { select: { lpDestinations: true } } },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant context invalid' });
      return;
    }

    if (tenant._count.lpDestinations >= tenant.maxDestinations) {
      res.status(403).json({
        error: `Destination limit reached. Your subscription plan only allows up to ${tenant.maxDestinations} destinations.`,
      });
      return;
    }

    // 2. Encrypt Password & write
    const encryptedPassword = encrypt(password);
    const destination = await prisma.lpDestination.create({
      data: {
        tenantId,
        brokerName,
        accountLabel,
        serverIp,
        port: parseInt(port),
        loginId,
        encryptedPassword,
        accountMode: accountMode || 'HEDGING',
        enableForwarding: enableForwarding !== false,
        deviationPt: deviationPt ? parseInt(deviationPt) : 10,
        magicId: magicId ? parseInt(magicId) : 999999,
        lotsDivisor: lotsDivisor ? parseFloat(lotsDivisor) : 1.0,
        destDealerWaitMs: destDealerWaitMs ? parseInt(destDealerWaitMs) : 0,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        destinationId: destination.id,
        eventType: 'DEST_CREATE',
        logLevel: 'INFO',
        message: `Tenant registered new destination account "${accountLabel}" (${brokerName})`,
      },
    });

    const { encryptedPassword: _, ...sanitized } = destination;
    res.status(201).json(sanitized);
  } catch (error) {
    console.error('[DESTINATIONS_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Failed to record connection destination' });
  }
});

/**
 * PUT /api/destinations/:id
 * Modify broker destination values.
 */
destinationsRouter.put('/:id', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user!.tenantId!;
  const { id } = req.params;
  const {
    brokerName,
    accountLabel,
    serverIp,
    port,
    loginId,
    password,
    accountMode,
    enableForwarding,
    deviationPt,
    magicId,
    lotsDivisor,
    destDealerWaitMs,
  } = req.body;

  try {
    // Confirm account ownership
    const existing = await prisma.lpDestination.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Destination profile not found or ownership denied' });
      return;
    }

    const data: any = {
      brokerName,
      accountLabel,
      serverIp,
      port: port ? parseInt(port) : undefined,
      loginId,
      accountMode,
      enableForwarding,
      deviationPt: deviationPt ? parseInt(deviationPt) : undefined,
      magicId: magicId ? parseInt(magicId) : undefined,
      lotsDivisor: lotsDivisor ? parseFloat(lotsDivisor) : undefined,
      destDealerWaitMs: destDealerWaitMs ? parseInt(destDealerWaitMs) : undefined,
    };

    if (password) {
      data.encryptedPassword = encrypt(password);
    }

    const updated = await prisma.lpDestination.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        destinationId: id,
        eventType: 'DEST_UPDATE',
        logLevel: 'INFO',
        message: `Tenant modified configuration details for destination: "${updated.accountLabel}"`,
      },
    });

    const { encryptedPassword: _, ...sanitized } = updated;
    res.status(200).json(sanitized);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update destination details' });
  }
});

/**
 * DELETE /api/destinations/:id
 * Delete destination account. Cascades routing rules.
 */
destinationsRouter.delete('/:id', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user!.tenantId!;
  const { id } = req.params;

  try {
    const existing = await prisma.lpDestination.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Destination profile not found or ownership denied' });
      return;
    }

    await prisma.lpDestination.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        eventType: 'DEST_DELETE',
        logLevel: 'WARN',
        message: `Tenant deleted destination account: "${existing.accountLabel}"`,
      },
    });

    res.status(200).json({ message: 'Destination removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to purge destination record' });
  }
});

/**
 * POST /api/destinations/:id/ping
 * Simulates server connection roundtrip latency counter.
 */
destinationsRouter.post('/:id/ping', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = req.user!.tenantId!;
  const { id } = req.params;

  try {
    const dest = await prisma.lpDestination.findFirst({
      where: { id, tenantId },
    });

    if (!dest) {
      res.status(404).json({ error: 'Destination not found' });
      return;
    }

    // High fidelity ping simulator based on IP length or random variance (2ms to 45ms range)
    const seed = dest.serverIp.split('.').reduce((acc, oct) => acc + parseInt(oct || '0'), 0);
    const latency = Math.round((seed % 30) + Math.random() * 8 + 3);

    res.status(200).json({
      destinationId: id,
      serverIp: dest.serverIp,
      status: 'ONLINE',
      latencyMs: latency,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed executing connection diagnostics ping' });
  }
});
