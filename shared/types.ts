/**
 * @file shared/types.ts
 * @description Shared TypeScript interfaces, types, and enumerations for the MT5 Trade Router monorepo.
 * Represents the data schemas mapping to the PostgreSQL / Prisma database and websocket messaging contracts.
 * 
 * Connected Modules:
 * - backend/prisma/schema.prisma (source database mapping)
 * - backend/src/ (Express REST API)
 * - mt-bridge/src/ (Router engine telemetry and execution)
 * - frontend/src/ (Admin interface dashboard state)
 */

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

export interface Tenant {
  id: string;
  companyName: string;
  email: string;
  licenseKey: string;
  status: TenantStatus;
  maxDestinations: number;
  monthlyVolumeLimitLots: number; // Decimal maps to number in TS
  licenseExpiresAt: string;       // Date string
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'TENANT_VIEWER';

export interface User {
  id: string;
  tenantId: string | null;
  email: string;
  passwordHash?: string; // Kept optional for security
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AccountMode = 'HEDGING' | 'NETTING';

export interface LpDestination {
  id: string;
  tenantId: string;
  brokerName: string;
  accountLabel: string;
  serverIp: string;
  port: number;
  loginId: string;
  encryptedPassword?: string; // Kept optional or omitted on frontend
  accountMode: AccountMode;
  enableForwarding: boolean;
  deviationPt: number;
  magicId: number;
  lotsDivisor: number; // e.g. 100, 1000, 10000 to scale lots
  destDealerWaitMs: number;
  createdAt: string;
  updatedAt: string;
}

export type ExecutionMode = 'COPIER' | 'DEALER_ONLY';

export interface RoutingRule {
  id: string;
  tenantId: string;
  destinationId: string;
  ruleName: string;
  sourceMt5Group: string;
  executionMode: ExecutionMode;
  priority: number; // 1-100 fallback weight
  isEnabled: boolean;
  minLot: number;
  maxLot: number;
  forceMt5Flags: number;
  createdAt: string;
  updatedAt: string;
}

export interface SymbolMapping {
  id: string;
  tenantId: string;
  destinationId: string;
  sourceSymbol: string;
  destinationSymbol: string;
  markupPoints: number;
  commissionOverride: number;
  swapBuyOverride: number;
  swapSellOverride: number;
  passSourceSpread: boolean;
  passFillPrice: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionPolicy {
  id: string;
  tenantId: string;
  policyName: string;
  addedLatencyOpenMs: number;
  addedLatencyCloseMs: number;
  requoteDelayMs: number;
  maxDeviationPoints: number;
  goodPriceWindowPoints: number;
  badPriceWindowPoints: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface AuditLog {
  id: string; // BIGINT is represented as string or number (usually string for precision in JSON serialization)
  tenantId: string | null;
  destinationId: string | null;
  eventType: string;
  logLevel: LogLevel;
  sourceGroup: string | null;
  symbol: string | null;
  volumeLots: number | null;
  executionLatencyMs: number | null;
  message: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ThemeConfig {
  primaryAccent: string;   // e.g. "#00F0FF"
  bgVoid: string;          // e.g. "#0B0E14"
  cardSurface: string;     // e.g. "#121721"
  successColor: string;    // e.g. "#00E676"
  errorColor: string;      // e.g. "#FF1744"
  warningColor: string;    // e.g. "#FFD600"
  fontFamily: string;
  borderRadius: string;
  glassOpacity: number;
}

export interface BrandingConfig {
  siteTitle: string;
  logoUrl: string;
  faviconUrl: string;
}

export interface GlobalSiteSettings {
  id: string;
  themeConfig: ThemeConfig;
  brandingConfig: BrandingConfig;
  updatedAt: string;
}

// Sandbox execution interface
export interface SandboxOrderPayload {
  destinationId: string;
  symbol: string;
  orderType: 'BUY' | 'SELL' | 'LIMIT_BUY' | 'LIMIT_SELL';
  lots: number;
  price?: number;
}

export interface SandboxOrderResponse {
  success: boolean;
  orderId?: string;
  executionLatencyMs: number;
  fillPrice?: number;
  errorMessage?: string;
  routedDestination?: string;
  precisionApplied?: number;
}

// Telemetry websocket event types
export interface TradeEventPayload {
  orderId: string;
  tenantId: string;
  destinationId: string;
  sourceGroup: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  requestedLots: number;
  scaledLots: number;
  requestedPrice: number;
  executedPrice: number;
  slippagePoints: number;
  latencyMs: number;
  timestamp: string;
  status: 'FILLED' | 'REJECTED' | 'REQUOTED';
}
