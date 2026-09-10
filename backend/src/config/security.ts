/**
 * Central security configuration. Production never falls back to source-coded
 * credentials; local and test environments receive clearly non-production keys.
 */
export function getSecuritySecret(name: 'JWT_SECRET' | 'ENCRYPTION_KEY' | 'SUPER_ADMIN_KEY'): string {
  const configured = process.env[name];
  if (configured && configured.trim().length >= 16) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be configured with a strong value in production`);
  }

  return `development-only-${name.toLowerCase()}-do-not-use-in-production`;
}