-- Keep the persisted global settings model aligned with schema.prisma.
ALTER TABLE "global_site_settings"
  ADD COLUMN "feature_flags" JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN "fee_config" JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN "tenant_defaults" JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN "cms_content" JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN "module_visibility" JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN "custom_css" TEXT;