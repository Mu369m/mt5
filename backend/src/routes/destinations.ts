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
import { requireTenantContext, getTenantId } from '../middleware/tenant';
import { encrypt } from '../utils/crypto';
import prisma from '../db';

export const destinationsRouter = Router();

// Apply licensing and tenant role validations to all endpoints
destinationsRouter.use(validateLicense);
destinationsRouter.use(requireTenantContext);

/**
 * GET /api/destinations
 * List all destinations configured for the authenticated tenant.
 */
destinationsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req)!;

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
    res.status(200).json(sanitized);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve destination profiles' });
  }
});

/**
 * POST /api/destinations
 * Add a new LP or MT5 target account.
 */
destinationsRouter.post('/', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Destination payload is required' });
    return;
  }

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

  if (typeof brokerName !== 'string' || !brokerName.trim() || typeof accountLabel !== 'string' || !accountLabel.trim() || typeof serverIp !== 'string' || !serverIp.trim() || typeof port !== 'string' || !port.trim() || typeof loginId !== 'string' || !loginId.trim() || typeof password !== 'string' || !password.trim()) {
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
    const encryptedPassword = encrypt(password.trim());
    const destination = await prisma.lpDestination.create({
      data: {
        tenantId,
        brokerName: brokerName.trim(),
        accountLabel: accountLabel.trim(),
        serverIp: serverIp.trim(),
        port: parseInt(port),
        loginId: loginId.trim(),
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
        message: `Tenant registered new destination account "${accountLabel.trim()}" (${brokerName.trim()})`,
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
  const tenantId = getTenantId(req)!;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Destination update payload is required' });
    return;
  }

  const id = String(req.params.id);
  if (typeof id !== 'string' || !id.trim()) {
    res.status(400).json({ error: 'Destination id is required' });
    return;
  }

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
      brokerName: typeof brokerName === 'string' && brokerName.trim() ? brokerName.trim() : undefined,
      accountLabel: typeof accountLabel === 'string' && accountLabel.trim() ? accountLabel.trim() : undefined,
      serverIp: typeof serverIp === 'string' && serverIp.trim() ? serverIp.trim() : undefined,
      port: typeof port === 'string' && port.trim() ? parseInt(port) : undefined,
      loginId: typeof loginId === 'string' && loginId.trim() ? loginId.trim() : undefined,
      accountMode: typeof accountMode === 'string' && accountMode.trim() ? accountMode.trim() : undefined,
      enableForwarding: typeof enableForwarding === 'boolean' ? enableForwarding : undefined,
      deviationPt: typeof deviationPt === 'string' && deviationPt.trim() ? parseInt(deviationPt) : undefined,
      magicId: typeof magicId === 'string' && magicId.trim() ? parseInt(magicId) : undefined,
      lotsDivisor: typeof lotsDivisor === 'string' && lotsDivisor.trim() ? parseFloat(lotsDivisor) : undefined,
      destDealerWaitMs: typeof destDealerWaitMs === 'string' && destDealerWaitMs.trim() ? parseInt(destDealerWaitMs) : undefined,
    };

    if (typeof password === 'string' && password.trim()) {
      data.encryptedPassword = encrypt(password.trim());
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
  const tenantId = getTenantId(req)!;
  const id = String(req.params.id);

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
  const tenantId = getTenantId(req)!;
  const id = String(req.params.id);

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
