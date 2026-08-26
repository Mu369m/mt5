-- BRP MT5 Trade Router — PostgreSQL Schema Reference
-- Primary source of truth: backend/prisma/schema.prisma
-- Run: pnpm db:push (development) or prisma migrate deploy (production)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- See backend/prisma/schema.prisma for full model definitions including:
-- tenants, users, lp_destinations, routing_rules, symbol_mappings,
-- execution_policies, audit_logs, global_site_settings
