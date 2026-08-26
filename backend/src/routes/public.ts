/**
 * @file backend/src/routes/public.ts
 * @description Unauthenticated public endpoints for CMS theme/branding and health metadata.
 * Allows the frontend ThemeProvider to load visual settings before login.
 */

import { Router, Request, Response } from 'express';
import prisma from '../db';
import { DEFAULT_BRANDING_CONFIG, DEFAULT_THEME_CONFIG } from '@workspace/shared/constants';

export const publicRouter = Router();

/**
 * GET /api/public/settings
 * Returns global site theme and branding configuration (no auth required).
 */
publicRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    let settings = await prisma.globalSiteSettings.findFirst();

    if (!settings) {
      settings = await prisma.globalSiteSettings.create({
        data: {
          themeConfig: DEFAULT_THEME_CONFIG,
          brandingConfig: DEFAULT_BRANDING_CONFIG,
        },
      });
    }

    res.status(200).json(settings);
  } catch (error) {
    console.error('[PUBLIC_SETTINGS_ERROR]', error);
    res.status(200).json({
      themeConfig: DEFAULT_THEME_CONFIG,
      brandingConfig: DEFAULT_BRANDING_CONFIG,
    });
  }
});

/**
 * GET /api/public/health
 * Lightweight public health probe for load balancers.
 */
publicRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: new Date().toISOString() });
});
