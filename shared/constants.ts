/**
 * @file shared/constants.ts
 * @description Shared environment variable keys, default theme presets, and routing constants.
 * Used across backend, mt-bridge, and frontend for consistent configuration references.
 */

/** Default cyber-institutional dark theme applied when no CMS settings exist. */
export const DEFAULT_THEME_CONFIG = {
  primaryAccent: '#00F0FF',
  bgVoid: '#0B0E14',
  cardSurface: '#121721',
  successColor: '#00E676',
  errorColor: '#FF1744',
  warningColor: '#FFD600',
  fontFamily: 'Inter',
  borderRadius: '8px',
  glassOpacity: 0.8,
} as const;

/** Default branding copy for new deployments. */
export const DEFAULT_BRANDING_CONFIG = {
  siteTitle: 'BRP Trade Router SaaS',
  logoUrl: '/assets/logo.svg',
  faviconUrl: '/favicon.ico',
} as const;

/** Preset theme bundles selectable from Super Admin CMS. */
export const THEME_PRESETS = {
  cyberDark: DEFAULT_THEME_CONFIG,
  midnightBlue: {
    ...DEFAULT_THEME_CONFIG,
    primaryAccent: '#4F8CFF',
    bgVoid: '#0A0F1E',
    cardSurface: '#111827',
  },
  institutionalSlate: {
    ...DEFAULT_THEME_CONFIG,
    primaryAccent: '#94A3B8',
    bgVoid: '#1E293B',
    cardSurface: '#334155',
  },
  customNeon: {
    ...DEFAULT_THEME_CONFIG,
    primaryAccent: '#FF00FF',
    successColor: '#39FF14',
  },
} as const;

/** Audit log event types tracked for monthly volume metering. */
export const METERED_EVENT_TYPES = ['ORDER_FILL', 'TRADE_EXECUTION', 'SANDBOX_ORDER'] as const;

/** Standard minimum lot precision for institutional routing. */
export const MIN_LOT_PRECISION = 0.01;
