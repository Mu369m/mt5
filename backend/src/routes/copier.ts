/**
 * @file backend/src/routes/copier.ts
 * @description Tenant-scoped Master-to-Slave copier control API.
 * Persists terminal connections/profiles, accepts normalized lifecycle events,
 * and exposes heartbeat/status data for the admin panel.
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { validateLicense } from '../middleware/license';
import { requireTenantContext, getTenantId } from '../middleware/tenant';
import prisma from '../db';
import { recordHeartbeat, markStaleConnections, getConnectionState, dispatchCopierEvent } from '../../../mt-bridge/src/copier';
import { CopierEventStatus } from '@prisma/client';

export const copierRouter = Router();
copierRouter.use(validateLicense);
copierRouter.use(requireTenantContext);

copierRouter.get('/connections', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req)!;
  markStaleConnections();
  const connections = await prisma.copierConnection.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  res.json(connections.map((connection) => ({ ...connection, runtime: getConnectionState(connection.id) })));
});

copierRouter.post('/connections', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const { name, platform, role, terminalVersion } = req.body;
  if (!name || !['MT4', 'MT5'].includes(platform) || !['MASTER', 'SLAVE'].includes(role)) {
    res.status(400).json({ error: 'name, platform (MT4/MT5), and role (MASTER/SLAVE) are required' });
    return;
  }
  const connection = await prisma.copierConnection.create({
    data: { tenantId, name, platform, role, terminalVersion, status: 'OFFLINE' },
  });
  res.status(201).json(connection);
});

copierRouter.post('/connections/:id/heartbeat', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const id = String(req.params.id);
  const connection = await prisma.copierConnection.findFirst({ where: { id, tenantId } });
  if (!connection) {
    res.status(404).json({ error: 'Copier connection not found' });
    return;
  }
  const sentAt = typeof req.body.sentAt === 'string' ? req.body.sentAt : new Date().toISOString();
  const runtime = recordHeartbeat({ connectionId: id, sentAt, terminalVersion: req.body.terminalVersion });
  const updated = await prisma.copierConnection.update({
    where: { id },
    data: { status: 'ONLINE', lastHeartbeatAt: new Date(sentAt), terminalVersion: req.body.terminalVersion },
  });
  res.json({ connection: updated, runtime });
});

copierRouter.get('/profiles', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req)!;
  res.json(await prisma.copierProfile.findMany({ where: { tenantId }, include: { masterConnection: true }, orderBy: { createdAt: 'desc' } }));
});

copierRouter.put('/profiles/:profileId', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const profileId = String(req.params.profileId);
  const existing = await prisma.copierProfile.findFirst({ where: { id: profileId, tenantId } });
  if (!existing) {
    res.status(404).json({ error: 'Copier profile not found' });
    return;
  }
  const { name, enabled, maxSlippagePoints, volumeMultiplier } = req.body;
  const updated = await prisma.copierProfile.update({
    where: { id: profileId },
    data: {
      name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
      enabled: typeof enabled === 'boolean' ? enabled : undefined,
      maxSlippagePoints: Number.isFinite(Number(maxSlippagePoints)) ? Number(maxSlippagePoints) : undefined,
      volumeMultiplier: Number.isFinite(Number(volumeMultiplier)) && Number(volumeMultiplier) > 0 ? Number(volumeMultiplier) : undefined,
    },
  });
  res.json(updated);
});

copierRouter.post('/profiles', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const { name, masterConnectionId, maxSlippagePoints, volumeMultiplier } = req.body;
  const master = await prisma.copierConnection.findFirst({ where: { id: masterConnectionId, tenantId, role: 'MASTER' } });
  if (!name || !master) {
    res.status(400).json({ error: 'A valid tenant-owned MASTER connection and profile name are required' });
    return;
  }
  const profile = await prisma.copierProfile.create({
    data: {
      tenantId,
      name,
      masterConnectionId,
      maxSlippagePoints: Number.isFinite(Number(maxSlippagePoints)) ? Number(maxSlippagePoints) : 20,
      volumeMultiplier: Number.isFinite(Number(volumeMultiplier)) && Number(volumeMultiplier) > 0 ? Number(volumeMultiplier) : 1,
    },
  });
  res.status(201).json(profile);
});

copierRouter.post('/profiles/:profileId/events', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const profileId = String(req.params.profileId);
  const profile = await prisma.copierProfile.findFirst({ where: { id: profileId, tenantId, enabled: true } });
  if (!profile) {
    res.status(404).json({ error: 'Enabled copier profile not found' });
    return;
  }
  const event = req.body;
  const eventTypes = ['ORDER_OPEN', 'ORDER_MODIFY', 'ORDER_CLOSE', 'PARTIAL_CLOSE', 'PENDING_TRIGGER'];
  if (!event?.eventId || !event?.masterTicket || !eventTypes.includes(event?.eventType) || !event?.symbol) {
    res.status(400).json({ error: 'eventId, masterTicket, eventType, and symbol are required' });
    return;
  }
  const existing = await prisma.copierEvent.findFirst({ where: { tenantId, eventId: event.eventId } });
  if (existing) {
    res.status(200).json({ event: existing, status: 'DUPLICATE' satisfies CopierEventStatus });
    return;
  }
  const created = await prisma.copierEvent.create({
    data: {
      tenantId,
      profileId: profile.id,
      eventId: event.eventId,
      masterTicket: event.masterTicket,
      eventType: event.eventType,
      symbol: event.symbol,
      direction: event.direction,
      volumeLots: event.volumeLots,
      price: event.price,
      stopLoss: event.stopLoss,
      takeProfit: event.takeProfit,
      closeVolumeLots: event.closeVolumeLots,
      occurredAt: new Date(event.occurredAt || Date.now()),
    },
  });
  const dispatch = await dispatchCopierEvent(event, req.body.slaveConnectionId || '', Number(profile.volumeMultiplier));
  const updated = await prisma.copierEvent.update({
    where: { id: created.id },
    data: { status: dispatch.status === 'APPLIED' ? 'APPLIED' : 'FAILED', latencyMs: dispatch.latencyMs, slaveTicket: dispatch.slaveTicket, errorMessage: dispatch.errorMessage, slaveConnectionId: req.body.slaveConnectionId || undefined },
  });
  res.status(dispatch.status === 'APPLIED' ? 202 : 503).json({ event: updated, dispatch });
});

copierRouter.get('/events', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req)!;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  res.json(await prisma.copierEvent.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: limit }));
});
