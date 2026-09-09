/**
 * @file mt-bridge/src/symbol-resolver.ts
 * @description Cross-broker symbol resolution with explicit mappings and optional
 * prefix/suffix normalization. Returns a deterministic candidate for live adapters.
 */

export interface SymbolResolutionConfig {
  explicitMappings?: Record<string, string>;
  prefixes?: string[];
  suffixes?: string[];
}

export function resolveDestinationSymbol(sourceSymbol: string, config: SymbolResolutionConfig = {}): string {
  if (typeof sourceSymbol !== 'string') {
    throw new Error('Source symbol is required');
  }

  const normalized = sourceSymbol.trim().toUpperCase();
  if (!normalized) {
    throw new Error('Source symbol is required');
  }

  const explicit = config.explicitMappings?.[normalized];
  if (explicit && typeof explicit === 'string') {
    const safeExplicit = explicit.trim().toUpperCase();
    if (!safeExplicit) throw new Error('Explicit destination symbol must not be empty');
    return safeExplicit;
  }

  const prefixes = (config.prefixes ?? []).map((prefix) => prefix.trim().toUpperCase());
  const suffixes = (config.suffixes ?? []).map((suffix) => suffix.trim().toUpperCase());

  const stripped = prefixes.reduce((value, prefix) => {
    return value.startsWith(prefix) ? value.slice(prefix.length) : value;
  }, normalized);

  const withoutSuffix = suffixes.reduce((value, suffix) => {
    return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
  }, stripped);

  if (!withoutSuffix) {
    throw new Error('Resolved destination symbol must not be empty');
  }

  return withoutSuffix;
}
