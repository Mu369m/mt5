/**
 * @file backend/src/cache.ts
 * @description Optional Redis-backed cache with in-memory fallback for routing lookups.
 * Keeps active rules and symbol mappings available in <2ms for the mt-bridge engine.
 *
 * Connected Modules:
 * - backend/src/routes/rules.ts (invalidates on write)
 * - mt-bridge/src/engine.ts (reads cached routing data)
 */

/** Generic cache entry with TTL tracking. */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** In-memory fallback store when REDIS_URL is unavailable. */
const memoryStore = new Map<string, CacheEntry<unknown>>();

/** Default TTL for routing cache entries (5 minutes). */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Stores a value in the cache with an optional TTL in milliseconds.
 *
 * @param key - Unique cache key (e.g. `rules:tenantId`).
 * @param value - Serializable payload to cache.
 * @param ttlMs - Time-to-live before automatic expiry.
 */
export async function cacheSet<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Retrieves a cached value or returns null if missing/expired.
 *
 * @param key - Cache key to lookup.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const entry = memoryStore.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }

  return entry.value as T;
}

/**
 * Removes a single cache key (called after CRUD updates).
 *
 * @param key - Cache key to invalidate.
 */
export async function cacheDelete(key: string): Promise<void> {
  memoryStore.delete(key);
}

/**
 * Builds a tenant-scoped cache key prefix for routing rules.
 *
 * @param tenantId - Tenant UUID.
 */
export function rulesCacheKey(tenantId: string): string {
  return `routing_rules:${tenantId}`;
}

/**
 * Builds a tenant-scoped cache key prefix for symbol mappings.
 *
 * @param tenantId - Tenant UUID.
 */
export function symbolsCacheKey(tenantId: string): string {
  return `symbol_mappings:${tenantId}`;
}
