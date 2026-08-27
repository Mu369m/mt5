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
import { enqueueAlert } from '../jobs';

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
  const { name, enabled, maxSlippagePoints, volumeMultiplier, executionMode, routingMode, reverseTrading, maxBBookExposureLots, maxDailyLossPercent, maxDrawdownPercent, maxExecutionTtlMs } = req.body;
  const updated = await prisma.copierProfile.update({
    where: { id: profileId },
    data: {
      name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
      enabled: typeof enabled === 'boolean' ? enabled : undefined,
      maxSlippagePoints: Number.isFinite(Number(maxSlippagePoints)) ? Number(maxSlippagePoints) : undefined,
      volumeMultiplier: Number.isFinite(Number(volumeMultiplier)) && Number(volumeMultiplier) > 0 ? Number(volumeMultiplier) : undefined,
      executionMode: executionMode === 'LIVE' || executionMode === 'SIMULATED' ? executionMode : undefined,
      routingMode: ['B_BOOK_INTERNAL', 'A_BOOK_FIX', 'HYBRID_AUTO'].includes(routingMode) ? routingMode : undefined,
      reverseTrading: typeof reverseTrading === 'boolean' ? reverseTrading : undefined,
      maxBBookExposureLots: Number.isFinite(Number(maxBBookExposureLots)) && Number(maxBBookExposureLots) >= 0 ? Number(maxBBookExposureLots) : undefined,
      maxDailyLossPercent: Number.isFinite(Number(maxDailyLossPercent)) && Number(maxDailyLossPercent) >= 0 ? Number(maxDailyLossPercent) : undefined,
      maxDrawdownPercent: Number.isFinite(Number(maxDrawdownPercent)) && Number(maxDrawdownPercent) >= 0 ? Number(maxDrawdownPercent) : undefined,
      maxExecutionTtlMs: Number.isFinite(Number(maxExecutionTtlMs)) ? Math.min(Math.max(Number(maxExecutionTtlMs), 500), 1000) : undefined,
    },
  });
  res.json(updated);
});

copierRouter.post('/profiles', requireRole(['TENANT_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tenantId = getTenantId(req)!;
  const { name, masterConnectionId, maxSlippagePoints, volumeMultiplier, executionMode, routingMode, reverseTrading, maxBBookExposureLots, maxDailyLossPercent, maxDrawdownPercent, maxExecutionTtlMs } = req.body;
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
      executionMode: executionMode === 'LIVE' ? 'LIVE' : 'SIMULATED',
      routingMode: ['B_BOOK_INTERNAL', 'A_BOOK_FIX', 'HYBRID_AUTO'].includes(routingMode) ? routingMode : 'HYBRID_AUTO',
      reverseTrading: reverseTrading === true,
      maxBBookExposureLots: Number.isFinite(Number(maxBBookExposureLots)) && Number(maxBBookExposureLots) >= 0 ? Number(maxBBookExposureLots) : 100,
      maxDailyLossPercent: Number.isFinite(Number(maxDailyLossPercent)) && Number(maxDailyLossPercent) >= 0 ? Number(maxDailyLossPercent) : 5,
      maxDrawdownPercent: Number.isFinite(Number(maxDrawdownPercent)) && Number(maxDrawdownPercent) >= 0 ? Number(maxDrawdownPercent) : 10,
      maxExecutionTtlMs: Number.isFinite(Number(maxExecutionTtlMs)) ? Math.min(Math.max(Number(maxExecutionTtlMs), 500), 1000) : 1000,
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
  if (dispatch.status === 'FAILED') {
    void enqueueAlert({
      subject: 'Copier dispatch failed',
      text: `${event.eventType} ${event.symbol} on event ${event.eventId}: ${dispatch.errorMessage ?? 'unknown error'}`,
      severity: 'CRITICAL',
    });
  }
  res.status(dispatch.status === 'APPLIED' ? 202 : 503).json({ event: updated, dispatch });
});

copierRouter.get('/events', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = getTenantId(req)!;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  res.json(await prisma.copierEvent.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: limit }));
});
