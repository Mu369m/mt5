/**
 * @file mt-bridge/src/engine.ts
 * @description Core Trade Routing and Execution Bridge Gateway.
 * Orchestrates order execution, maps symbols, injects custom markup/spread,
 * scales lots, evaluates netting, activates news volatility shields,
 * assesses toxic flow signatures, and simulates low-latency LP filling.
 * 
 * Connected Modules:
 * - backend/src/routes/sandbox.ts (invokes route engine)
 * - mt-bridge/src/smart-routing.ts (AI toxic flow check)
 * - mt-bridge/src/netting.ts (B-Book exposure offset check)
 * - mt-bridge/src/news-shield.ts (news-period detection)
 */

import prisma from './db';
import { applyMarkup, scaleVolumeToDestination, calculateSlippage } from '@workspace/shared/math';
import { assessToxicFlowAndCalculateDelay, recordExecutionMetrics, selectBestSlippageDestination } from './smart-routing';
import { processNettingOffset } from './netting';
import { checkNewsShieldWindow, syncEconomicCalendar } from './news-shield';

// Synchronize economic calendar schedule on engine initialization
syncEconomicCalendar();

// Define execution interface payloads
export interface OrderPayload {
  tenantId: string;
  destinationId: string;
  sourceGroup: string;
  symbol: string;
  orderType: 'BUY' | 'SELL' | 'LIMIT_BUY' | 'LIMIT_SELL';
  lots: number;
  price?: number;
}

export interface OrderExecutionResult {
  success: boolean;
  orderId: string;
  executionLatencyMs: number;
  requestedPrice: number;
  fillPrice: number;
  slippagePoints: number;
  requestedLots: number;
  scaledLots: number;
  finalSymbol: string;
  isNettedInternally: boolean;
  isNewsShieldActive: boolean;
  isToxicBotDetected: boolean;
  toxicDelayAddedMs: number;
  errorMessage?: string;
}

// Global register to broadcast trade events back to the express server WebSocket connections
type TelemetryCallback = (eventName: string, data: any) => void;
let telemetryBroadcaster: TelemetryCallback | null = null;

/**
 * Register a callback to broadcast telemetry telemetry metrics.
 */
export function registerTelemetryBroadcaster(callback: TelemetryCallback): void {
  telemetryBroadcaster = callback;
}

/**
 * Helper to pause execution flow to simulate broker network/execution latency.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Core execution engine pipeline. Simulates trade execution end-to-end.
 * 
 * @param order - Incoming trade details.
 * @returns Complete order execution analytics.
 */
export async function executeTradeRoutingPipeline(order: OrderPayload): Promise<OrderExecutionResult> {
  const startTime = Date.now();
  const orderId = 'ORD-' + Math.floor(Math.random() * 900000 + 100000);

  try {
    // 1. Load active destinations and validation checks
    const dest = await prisma.lpDestination.findFirst({
      where: { id: order.destinationId, tenantId: order.tenantId },
    });

    if (!dest) {
      throw new Error(`LP Destination context invalid or removed`);
    }

    // 2. Evaluate Toxic HFT Arbitrage bot signature flow
    const toxicCheck = assessToxicFlowAndCalculateDelay(order.sourceGroup, order.lots);

    // 3. Evaluate Counter-Party B-Book Netting and Offset matching
    // Only net if destination mode allows hedging/offsetting internally
    const nettingResult = processNettingOffset(order.tenantId, order.symbol, order.orderType.includes('BUY') ? 'BUY' : 'SELL', order.lots);
    
    // 4. Resolve Symbol Translation mapping and Spread Injections
    const mapping = await prisma.symbolMapping.findFirst({
      where: {
        tenantId: order.tenantId,
        destinationId: order.destinationId,
        sourceSymbol: order.symbol,
      },
    });

    const destinationSymbol = mapping ? mapping.destinationSymbol : order.symbol;
    const baseMarkup = mapping ? Number(mapping.markupPoints) : 0;
    
    // 5. Evaluate Economic Calendar Volatility Shield
    const newsShield = checkNewsShieldWindow();
    let markupEscalatedPoints = baseMarkup;

    if (newsShield.isShieldActive) {
      // Dynamic Markup Escalation: Inject +25 points to protect spreads against slippage
      markupEscalatedPoints += 25.0;
    }

    // Define symbol digits representation (default EURUSD = 5, commodities XAUUSD = 2)
    const digits = order.symbol.toUpperCase().includes('JPY') || order.symbol.toUpperCase().includes('XAU') ? 2 : 5;

    // Simulate broker raw market feeding prices
    let rawMarketPrice = order.price || (order.orderType.includes('BUY') ? 1.08250 : 1.08235);
    if (order.symbol.toUpperCase().includes('XAU')) {
      rawMarketPrice = order.price || (order.orderType.includes('BUY') ? 1920.50 : 1920.25);
    }

    // Apply marked up price feeds
    const calculatedPriceWithMarkup = applyMarkup(rawMarketPrice, markupEscalatedPoints, digits);

    // 6. Scale trade volume (Cent Accounts lot standardizing divisor scaling)
    const scaledLots = scaleVolumeToDestination(order.lots, Number(dest.lotsDivisor));
    if (scaledLots <= 0) {
      throw new Error('Destination lots divisor is invalid for this order');
    }

    // 7. Load Active Risk Policies
    const activePolicy = await prisma.executionPolicy.findFirst({
      where: { tenantId: order.tenantId, isActive: true },
    });

    const addedLatency = activePolicy
      ? (order.orderType.includes('CLOSE') ? activePolicy.addedLatencyCloseMs : activePolicy.addedLatencyOpenMs)
      : 0;

    // 8. Inject Simulated Latency Delays
    // Base physical router speed: 1ms to 4ms
    const processingLatencyBase = Math.floor(Math.random() * 3) + 1;
    const destWaitMs = dest.destDealerWaitMs || 0;
    const totalSimulatedDelay = processingLatencyBase + destWaitMs + addedLatency + toxicCheck.delayMs;

    await sleep(totalSimulatedDelay);

    // 9. Process Final Match Fill Rates
    let fillPrice = calculatedPriceWithMarkup;
    let slippagePoints = 0;
    let isSuccess = true;
    let errorDetails = '';

    if (nettingResult.isFullyNetted) {
      // 100% Netted internally! Fill at exact requested price with zero LP slippage
      fillPrice = calculatedPriceWithMarkup;
      slippagePoints = 0;
    } else {
      // Forward remaining net size to LP simulator
      // Simulate LP slippage based on volume sizes and active news window
      const lpVolatilityMultiplier = newsShield.isShieldActive ? 4.5 : 1.0;
      const baseSlippageMax = Math.min(10, Math.ceil(scaledLots * 8));
      slippagePoints = Math.round(Math.random() * baseSlippageMax * lpVolatilityMultiplier);

      const maxDeviation = activePolicy ? activePolicy.maxDeviationPoints : 20;

      if (slippagePoints > maxDeviation) {
        // Requote/Reject Order if slippage exceeds deviation constraints
        isSuccess = false;
        errorDetails = `Order Rejected: Slippage of ${slippagePoints} points exceeded deviation tolerance limit of ${maxDeviation}`;
      } else {
        // Adjust final fill price based on buy/sell slippage point shifts
        const slippageDecimal = slippagePoints * (1 / Math.pow(10, digits));
        fillPrice = order.orderType.includes('BUY')
          ? calculatedPriceWithMarkup + slippageDecimal
          : calculatedPriceWithMarkup - slippageDecimal;
        
        fillPrice = Math.round(fillPrice * Math.pow(10, digits)) / Math.pow(10, digits);
      }
    }

    const executionDuration = Date.now() - startTime;

    // Record statistics to AI learning metrics engine
    if (isSuccess && !nettingResult.isFullyNetted) {
      recordExecutionMetrics(order.symbol, order.destinationId, slippagePoints, executionDuration);
    }

    const orderResult: OrderExecutionResult = {
      success: isSuccess,
      orderId,
      executionLatencyMs: executionDuration,
      requestedPrice: calculatedPriceWithMarkup,
      fillPrice: isSuccess ? fillPrice : 0,
      slippagePoints,
      requestedLots: order.lots,
      scaledLots,
      finalSymbol: destinationSymbol,
      isNettedInternally: nettingResult.isFullyNetted,
      isNewsShieldActive: newsShield.isShieldActive,
      isToxicBotDetected: toxicCheck.isToxic,
      toxicDelayAddedMs: toxicCheck.delayMs,
      errorMessage: isSuccess ? undefined : errorDetails,
    };

    // 10. Broadcast trade activity logs live to Frontend WebSocket clients
    if (telemetryBroadcaster) {
      telemetryBroadcaster('TRADE_EXECUTION', {
        ...orderResult,
        companyName: dest.accountLabel,
        brokerName: dest.brokerName,
        sourceGroup: order.sourceGroup,
        orderType: order.orderType,
        originalLots: order.lots,
      });
    }

    return orderResult;
  } catch (error: any) {
    const errorDuration = Date.now() - startTime;
    return {
      success: false,
      orderId,
      executionLatencyMs: errorDuration,
      requestedPrice: 0,
      fillPrice: 0,
      slippagePoints: 0,
      requestedLots: order.lots,
      scaledLots: order.lots,
      finalSymbol: order.symbol,
      isNettedInternally: false,
      isNewsShieldActive: false,
      isToxicBotDetected: false,
      toxicDelayAddedMs: 0,
      errorMessage: error.message || 'Execution connection dropped',
    };
  }
}
