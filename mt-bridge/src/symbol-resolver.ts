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

function validatePrefixes(prefixes: string[] | undefined): void {
  if (!prefixes) return;
  if (!Array.isArray(prefixes)) {
    throw new Error('Prefix entries must be an array of non-empty strings');
  }
  if (prefixes.some((prefix) => typeof prefix !== 'string' || !prefix.trim())) {
    throw new Error('Prefix entries must be non-empty strings');
  }
}

function validateSuffixes(suffixes: string[] | undefined): void {
  if (!suffixes) return;
  if (!Array.isArray(suffixes)) {
    throw new Error('Suffix entries must be an array of non-empty strings');
  }
  if (suffixes.some((suffix) => typeof suffix !== 'string' || !suffix.trim())) {
    throw new Error('Suffix entries must be non-empty strings');
  }
}

export function resolveDestinationSymbol(sourceSymbol: string, config: SymbolResolutionConfig = {}): string {
  if (typeof sourceSymbol !== 'string') {
    throw new Error('Source symbol is required');
  }

  const normalized = sourceSymbol.trim().toUpperCase();
  if (!normalized) {
    throw new Error('Source symbol is required');
  }

  if (config.explicitMappings && typeof config.explicitMappings !== 'object') {
    throw new Error('Explicit mappings must be an object');
  }

  const explicit = config.explicitMappings?.[normalized];
  if (explicit !== undefined) {
    if (typeof explicit !== 'string') {
      throw new Error('Explicit destination symbol must be a string');
    }
    const safeExplicit = explicit.trim().toUpperCase();
    if (!safeExplicit) throw new Error('Explicit destination symbol must not be empty');
    return safeExplicit;
  }

  validatePrefixes(config.prefixes);
  validateSuffixes(config.suffixes);

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
