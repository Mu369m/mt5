/**
 * @file mt-bridge/src/router.ts
 * @description Group-to-destination routing resolver with priority weighting and smart LP failover.
 * Reads routing rules from database (with optional cache) and selects the best destination.
 *
 * Connected Modules:
 * - backend/src/routes/bridge.ts (HTTP entry point)
 * - mt-bridge/src/smart-routing.ts (slippage-based LP selection)
 */

import prisma from './db';
import { selectBestSlippageDestination } from './smart-routing';

export interface RouteResolution {
  destinationId: string;
  ruleId: string;
  ruleName: string;
  executionMode: 'COPIER' | 'DEALER_ONLY';
  priority: number;
}

/**
 * Finds the highest-priority enabled routing rule matching a source MT5 group.
 * Supports wildcard suffix matching (e.g. rule "JK1\\1A\\*" matches "JK1\\1A\\G-fwd").
 *
 * @param tenantId - Tenant UUID for data isolation.
 * @param sourceGroup - MT5 client group string (e.g. "JK1\\1A\\G-fwd").
 * @param lots - Order volume for min/max lot filter validation.
 */
export async function resolveDestinationForGroup(
  tenantId: string,
  sourceGroup: string,
  lots: number,
  symbol = 'EURUSD'
): Promise<RouteResolution | null> {
  const rules = await prisma.routingRule.findMany({
    where: {
      tenantId,
      isEnabled: true,
      destination: { tenantId, enableForwarding: true },
    },
    include: { destination: true },
    orderBy: { priority: 'desc' },
  });

  const matchedRules = rules.filter((rule) => {
    const minLot = Number(rule.minLot);
    const maxLot = Number(rule.maxLot);
    if (lots < minLot || lots > maxLot) {
      return false;
    }

    // Exact match or wildcard pattern (trailing *)
    if (rule.sourceMt5Group === sourceGroup) {
      return true;
    }
    if (rule.sourceMt5Group.endsWith('*')) {
      const prefix = rule.sourceMt5Group.slice(0, -1);
      return sourceGroup.startsWith(prefix);
    }

    return false;
  });

  if (matchedRules.length === 0) {
    return null;
  }

  // Smart LP routing: pick lowest slippage among matched rule destinations
  const candidateIds = matchedRules.map((r) => r.destinationId);
  const bestDestId = selectBestSlippageDestination(symbol, candidateIds) ?? matchedRules[0].destinationId;

  const selectedRule = matchedRules.find((r) => r.destinationId === bestDestId) ?? matchedRules[0];

  return {
    destinationId: selectedRule.destinationId,
    ruleId: selectedRule.id,
    ruleName: selectedRule.ruleName,
    executionMode: selectedRule.executionMode,
    priority: selectedRule.priority,
  };
}
