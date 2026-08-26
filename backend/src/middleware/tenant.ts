/**
 * @file backend/src/middleware/tenant.ts
 * @description Helpers for resolving tenant context on tenant-scoped API routes.
 * Super Admins must impersonate a tenant before accessing tenant dashboards.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

/**
 * Ensures the request has a valid tenant_id (from JWT or impersonation token).
 * Blocks Super Admin sessions that have not impersonated a tenant.
 */
export function requireTenantContext(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.tenantId) {
    res.status(403).json({
      error: 'Tenant context required. Super Admins must use "Login as Tenant" impersonation.',
    });
    return;
  }
  next();
}

/**
 * Returns the authenticated tenant ID or null when unavailable.
 *
 * @param req - Authenticated Express request.
 */
export function getTenantId(req: AuthenticatedRequest): string | null {
  return req.user?.tenantId ?? null;
}
