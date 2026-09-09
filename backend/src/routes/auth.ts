/**
 * @file backend/src/routes/auth.ts
 * @description API router managing Authentication services (login, registration, bootstrap validation).
 * Automatically handles Tenant creation for Tenant Admins and supports Super Admin bootstrapping.
 * 
 * Connected Modules:
 * - backend/src/server.ts (registers routes)
 * - backend/src/middleware/auth.ts (verifies tokens)
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../db';

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-institutional-jwt-signing-key-value-999';

/**
 * Helper to generate a tenant license key
 */
function generateLicenseKey(): string {
  return 'BRP-' + crypto.randomBytes(16).toString('hex').toUpperCase().match(/.{1,4}/g)?.join('-');
}

/**
 * POST /api/auth/register
 * Register a new Tenant Admin user along with their company profile.
 */
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Registration payload is required' });
    return;
  }

  const { companyName, email, password, superAdminCode } = req.body;

  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password.trim()) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (typeof superAdminCode === 'string' && !superAdminCode.trim()) {
    res.status(400).json({ error: 'Super admin setup key must be a non-empty string when supplied' });
    return;
  }

  if (typeof companyName !== 'undefined' && typeof companyName !== 'string') {
    res.status(400).json({ error: 'Company name must be a string when supplied' });
    return;
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      res.status(409).json({ error: 'Email is already registered' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(normalizedPassword, salt);

    // Bootstrapping as a SUPER_ADMIN
    if (superAdminCode) {
      if (superAdminCode !== process.env.SUPER_ADMIN_KEY) {
        res.status(403).json({ error: 'Invalid Super Admin setup key' });
        return;
      }

      const superUser = await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role: 'SUPER_ADMIN',
          tenantId: null,
          isActive: true,
        },
      });

      res.status(201).json({
        message: 'Super Admin registered successfully',
        userId: superUser.id,
        role: superUser.role,
      });
      return;
    }

    // Default Tenant creation workflow
    if (typeof companyName !== 'string' || !companyName.trim()) {
      res.status(400).json({ error: 'Company Name is required for standard client accounts' });
      return;
    }

    const normalizedCompanyName = companyName.trim();

    // Generate license details: active for exactly 1 year by default
    const expiration = new Date();
    expiration.setFullYear(expiration.getFullYear() + 1);

    const licenseKey = generateLicenseKey();

    // Perform inside transaction to guarantee database consistency
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          companyName: normalizedCompanyName,
          email: normalizedEmail,
          licenseKey,
          status: 'ACTIVE',
          maxDestinations: 5,
          monthlyVolumeLimitLots: 10000.0,
          licenseExpiresAt: expiration,
        },
      });

      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role: 'TENANT_ADMIN',
          tenantId: tenant.id,
          isActive: true,
        },
      });

      // Insert default global settings if none exist
      const settingsCount = await tx.globalSiteSettings.count();
      if (settingsCount === 0) {
        await tx.globalSiteSettings.create({
          data: {
            themeConfig: {
              primaryAccent: '#00F0FF',
              bgVoid: '#0B0E14',
              cardSurface: '#121721',
              successColor: '#00E676',
              errorColor: '#FF1744',
              warningColor: '#FFD600',
              fontFamily: 'Inter',
              borderRadius: '8px',
              glassOpacity: 0.8,
            },
            brandingConfig: {
              siteTitle: 'BRP Trade Router SaaS',
              logoUrl: '/assets/logo.svg',
              faviconUrl: '/favicon.ico',
            },
          },
        });
      }

      return { tenant, user };
    });

    res.status(201).json({
      message: 'Client account and workspace created successfully',
      userId: result.user.id,
      companyName: result.tenant.companyName,
      licenseKey: result.tenant.licenseKey,
      role: result.user.role,
    });
  } catch (error) {
    console.error('[REGISTRATION_ERROR]', error);
    res.status(500).json({ error: 'Internal registration processing failure' });
  }
});

/**
 * POST /api/auth/login
 * Standard login validator returning access tokens.
 */
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Login payload is required' });
    return;
  }

  const { email, password } = req.body;

  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password.trim()) {
    res.status(400).json({ error: 'Credentials are required' });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { tenant: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Account has been disabled by administrators' });
      return;
    }

    const isMatch = await bcrypt.compare(normalizedPassword, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Sign jwt token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        companyName: user.tenant?.companyName || null,
        licenseKey: user.tenant?.licenseKey || null,
        licenseStatus: user.tenant?.status || null,
      },
    });
  } catch (error) {
    console.error('[LOGIN_ERROR]', error);
    res.status(500).json({ error: 'Authentication request failure' });
  }
});
