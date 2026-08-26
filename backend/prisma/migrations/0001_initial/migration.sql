-- Initial PostgreSQL schema for the MT5 router and copier platform.
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_VIEWER');
CREATE TYPE "AccountMode" AS ENUM ('HEDGING', 'NETTING');
CREATE TYPE "ExecutionMode" AS ENUM ('COPIER', 'DEALER_ONLY');
CREATE TYPE "CopierPlatform" AS ENUM ('MT4', 'MT5');
CREATE TYPE "CopierConnectionRole" AS ENUM ('MASTER', 'SLAVE');
CREATE TYPE "CopierConnectionStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADED');
CREATE TYPE "CopierEventType" AS ENUM ('ORDER_OPEN', 'ORDER_MODIFY', 'ORDER_CLOSE', 'PARTIAL_CLOSE', 'PENDING_TRIGGER');
CREATE TYPE "CopierEventStatus" AS ENUM ('RECEIVED', 'DISPATCHED', 'APPLIED', 'FAILED', 'DUPLICATE');
CREATE TYPE "ExecutionPipelineMode" AS ENUM ('SIMULATED', 'LIVE');
CREATE TYPE "RoutingMode" AS ENUM ('B_BOOK_INTERNAL', 'A_BOOK_FIX', 'HYBRID_AUTO');
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR', 'CRITICAL');

CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "license_key" VARCHAR(100) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "max_destinations" INTEGER NOT NULL DEFAULT 5,
    "monthly_volume_limit_lots" DECIMAL(12,2) NOT NULL DEFAULT 10000.00,
    "license_expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TENANT_ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "lp_destinations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "broker_name" VARCHAR(100) NOT NULL,
    "account_label" VARCHAR(100) NOT NULL,
    "server_ip" VARCHAR(100) NOT NULL,
    "port" INTEGER NOT NULL,
    "login_id" VARCHAR(100) NOT NULL,
    "encrypted_password" TEXT NOT NULL,
    "account_mode" "AccountMode" NOT NULL DEFAULT 'HEDGING',
    "enable_forwarding" BOOLEAN NOT NULL DEFAULT true,
    "deviation_pt" INTEGER NOT NULL DEFAULT 10,
    "magic_id" INTEGER NOT NULL DEFAULT 999999,
    "lots_divisor" DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
    "dest_dealer_wait_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "lp_destinations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "routing_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "rule_name" VARCHAR(100) NOT NULL,
    "source_mt5_group" VARCHAR(150) NOT NULL,
    "execution_mode" "ExecutionMode" NOT NULL DEFAULT 'COPIER',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "min_lot" DECIMAL(10,2) NOT NULL DEFAULT 0.01,
    "max_lot" DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    "force_mt5_flags" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "routing_rules_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "symbol_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "source_symbol" VARCHAR(50) NOT NULL,
    "destination_symbol" VARCHAR(50) NOT NULL,
    "markup_points" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "commission_override" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "swap_buy_override" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "swap_sell_override" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "pass_source_spread" BOOLEAN NOT NULL DEFAULT true,
    "pass_fill_price" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "symbol_mappings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "execution_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "policy_name" VARCHAR(100) NOT NULL,
    "added_latency_open_ms" INTEGER NOT NULL DEFAULT 0,
    "added_latency_close_ms" INTEGER NOT NULL DEFAULT 0,
    "requote_delay_ms" INTEGER NOT NULL DEFAULT 0,
    "max_deviation_points" INTEGER NOT NULL DEFAULT 20,
    "good_price_window_points" INTEGER NOT NULL DEFAULT 5,
    "bad_price_window_points" INTEGER NOT NULL DEFAULT 15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "execution_policies_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID,
    "destination_id" UUID,
    "event_type" VARCHAR(50) NOT NULL,
    "log_level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "source_group" VARCHAR(100),
    "symbol" VARCHAR(50),
    "volume_lots" DECIMAL(10,2),
    "execution_latency_ms" INTEGER,
    "message" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "copier_connections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "platform" "CopierPlatform" NOT NULL,
    "role" "CopierConnectionRole" NOT NULL,
    "status" "CopierConnectionStatus" NOT NULL DEFAULT 'OFFLINE',
    "last_heartbeat_at" TIMESTAMPTZ,
    "terminal_version" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "copier_connections_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "copier_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "master_connection_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "max_slippage_points" INTEGER NOT NULL DEFAULT 20,
    "volume_multiplier" DECIMAL(12,6) NOT NULL DEFAULT 1.0,
    "execution_mode" "ExecutionPipelineMode" NOT NULL DEFAULT 'SIMULATED',
    "routing_mode" "RoutingMode" NOT NULL DEFAULT 'HYBRID_AUTO',
    "reverse_trading" BOOLEAN NOT NULL DEFAULT false,
    "max_bbook_exposure_lots" DECIMAL(12,6) NOT NULL DEFAULT 100,
    "max_daily_loss_percent" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "max_drawdown_percent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "max_execution_ttl_ms" INTEGER NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "copier_profiles_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "copier_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "slave_connection_id" UUID,
    "event_id" VARCHAR(100) NOT NULL,
    "master_ticket" VARCHAR(100) NOT NULL,
    "event_type" "CopierEventType" NOT NULL,
    "status" "CopierEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "symbol" VARCHAR(50) NOT NULL,
    "direction" VARCHAR(4),
    "volume_lots" DECIMAL(12,6),
    "price" DECIMAL(20,10),
    "stop_loss" DECIMAL(20,10),
    "take_profit" DECIMAL(20,10),
    "close_volume_lots" DECIMAL(12,6),
    "slave_ticket" VARCHAR(100),
    "latency_ms" INTEGER,
    "error_message" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "copier_events_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "global_site_settings" (
    "id" UUID NOT NULL,
    "theme_config" JSONB NOT NULL,
    "branding_config" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "global_site_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_email_key" ON "tenants"("email");
CREATE UNIQUE INDEX "tenants_license_key_key" ON "tenants"("license_key");
CREATE INDEX "idx_tenants_license_status" ON "tenants"("license_key", "status");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "idx_users_tenant" ON "users"("tenant_id");
CREATE INDEX "idx_destinations_tenant" ON "lp_destinations"("tenant_id", "enable_forwarding");
CREATE INDEX "idx_routing_tenant_group" ON "routing_rules"("tenant_id", "source_mt5_group", "is_enabled");
CREATE INDEX "idx_symbol_mappings_lookup" ON "symbol_mappings"("tenant_id", "source_symbol");
CREATE UNIQUE INDEX "symbol_mappings_tenant_id_destination_id_source_symbol_key" ON "symbol_mappings"("tenant_id", "destination_id", "source_symbol");
CREATE INDEX "idx_execution_policies_tenant" ON "execution_policies"("tenant_id");
CREATE INDEX "idx_audit_logs_tenant_time" ON "audit_logs"("tenant_id", "created_at" DESC);
CREATE INDEX "idx_copier_connections_tenant" ON "copier_connections"("tenant_id", "role", "status");
CREATE INDEX "idx_copier_profiles_tenant" ON "copier_profiles"("tenant_id", "enabled");
CREATE INDEX "idx_copier_events_tenant_time" ON "copier_events"("tenant_id", "created_at" DESC);
CREATE UNIQUE INDEX "copier_events_tenant_id_event_id_key" ON "copier_events"("tenant_id", "event_id");

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lp_destinations" ADD CONSTRAINT "lp_destinations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "lp_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "symbol_mappings" ADD CONSTRAINT "symbol_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "symbol_mappings" ADD CONSTRAINT "symbol_mappings_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "lp_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_policies" ADD CONSTRAINT "execution_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "lp_destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "copier_connections" ADD CONSTRAINT "copier_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copier_profiles" ADD CONSTRAINT "copier_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copier_profiles" ADD CONSTRAINT "copier_profiles_master_connection_id_fkey" FOREIGN KEY ("master_connection_id") REFERENCES "copier_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copier_events" ADD CONSTRAINT "copier_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copier_events" ADD CONSTRAINT "copier_events_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "copier_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copier_events" ADD CONSTRAINT "copier_events_slave_connection_id_fkey" FOREIGN KEY ("slave_connection_id") REFERENCES "copier_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
