/**
 * @file backend/src/middleware/auth.ts
 * @description JWT and API Key security middleware for authentication and multi-role authorization.
 * Handles access verification for roles: SUPER_ADMIN, TENANT_ADMIN, and TENANT_VIEWER.
 * 
 * Connected Modules:
 * - backend/src/routes/auth.ts (issues tokens)
 * - backend/src/server.ts (attaches middleware globally/locally)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request interface to include session metadata
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TENANT_VIEWER';
    tenantId: string | null;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-institutional-jwt-signing-key-value-999';

/**
 * Middleware that authenticates incoming requests using Bearer JWT or x-api-key.
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const apiKey = req.headers['x-api-key'] as string;

  // 1. Check API Key Authenticator first (for external gateway/LP connection requests)
  if (apiKey) {
    // In a production system, we lookup the active API keys for tenants in the database.
    // For simplicity and ease of routing, we inspect if it's the Super Admin override key first:
    if (apiKey === process.env.SUPER_ADMIN_KEY) {
      req.user = {
        id: 'super-admin-api-user-uuid',
        email: 'api-admin@institutional.router',
        role: 'SUPER_ADMIN',
        tenantId: null,
      };
      return next();
    }
  }

  // 2. JWT-based authentication
  if (!token) {
    res.status(401).json({ error: 'Access token required or invalid authentication headers' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: 'Token expired or invalid signature' });
      return;
    }

    req.user = decoded as {
      id: string;
      email: string;
      role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TENANT_VIEWER';
      tenantId: string | null;
    };
    next();
  });
}

/**
 * Middleware constructor that restricts route endpoints to specific security roles.
 * 
 * @param roles - List of allowed roles (e.g. ['SUPER_ADMIN', 'TENANT_ADMIN'])
 */
export function requireRole(roles: ('SUPER_ADMIN' | 'TENANT_ADMIN' | 'TENANT_VIEWER')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'User session not initialized' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient role credentials' });
      return;
    }

    next();
  };
}
