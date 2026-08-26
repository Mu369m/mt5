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
  const normalized = sourceSymbol.trim().toUpperCase();
  if (!normalized) throw new Error('Source symbol is required');
  const explicit = config.explicitMappings?.[normalized];
  if (explicit) return explicit;

  const prefixes = config.prefixes ?? [];
  const suffixes = config.suffixes ?? [];
  const stripped = prefixes.reduce((value, prefix) => value.startsWith(prefix.toUpperCase()) ? value.slice(prefix.length) : value, normalized);
  const withoutSuffix = suffixes.reduce((value, suffix) => value.endsWith(suffix.toUpperCase()) ? value.slice(0, -suffix.length) : value, stripped);
  return withoutSuffix;
}
