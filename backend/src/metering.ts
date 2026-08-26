/**
 * @file backend/src/metering.ts
 * @description Real-time lot volume utilization meter and threshold monitoring service.
 * Tracks usage quotas and dispatches alerts when tenants reach critical boundaries (80% and 100%).
 * 
 * Connected Modules:
 * - backend/src/routes/sandbox.ts (invokes usage check upon order execution)
 * - mt-bridge/src/engine.ts (invokes usage check upon order execution)
 */

import prisma from './db';

interface BillingStatus {
  tenantId: string;
  companyName: string;
  monthlyLimitLots: number;
  totalTradedLots: number;
  utilizationPercentage: number;
  is80PercentAlertSent: boolean;
  is100PercentAlertSent: boolean;
}

// Keep track of alert states in memory to avoid repeating notifications
const sentAlerts = new Map<string, { alert80: boolean; alert100: boolean }>();

/**
 * Checks and updates the monthly lot trade volume consumption for a specific tenant.
 * Automatically dispatches simulated notification webhooks, emails, and telegram messages
 * if critical thresholds (80% and 100% of limit) are crossed.
 * 
 * @param tenantId - The unique identifier of the tenant.
 * @param additionalLots - The lot size to record from the current execution.
 * @returns The updated utilization status.
 */
export async function trackUsageVolume(tenantId: string, additionalLots: number): Promise<BillingStatus | null> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      console.warn(`[METERING_WARNING] Tenant ${tenantId} not found`);
      return null;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sum all volume lots in audit logs for this month
    const volumeAggregate = await prisma.auditLog.aggregate({
      where: {
        tenantId: tenantId,
        createdAt: { gte: startOfMonth },
        eventType: { in: ['ORDER_FILL', 'TRADE_EXECUTION', 'SANDBOX_ORDER'] },
      },
      _sum: {
        volumeLots: true,
      },
    });

    const currentTradedLots = volumeAggregate._sum.volumeLots ? Number(volumeAggregate._sum.volumeLots) : 0;
    const totalTradedLots = currentTradedLots + additionalLots;
    const limitLots = Number(tenant.monthlyVolumeLimitLots);
    const utilizationPercentage = limitLots > 0 ? (totalTradedLots / limitLots) * 100 : 0;

    // Load alert states
    let alertState = sentAlerts.get(tenantId);
    if (!alertState) {
      alertState = { alert80: false, alert100: false };
      sentAlerts.set(tenantId, alertState);
    }

    // Check thresholds and dispatch notifications
    if (utilizationPercentage >= 100 && !alertState.alert100) {
      alertState.alert100 = true;
      await triggerAlertNotification(tenantId, tenant.companyName, totalTradedLots, limitLots, 100);
    } else if (utilizationPercentage >= 80 && utilizationPercentage < 100 && !alertState.alert80) {
      alertState.alert80 = true;
      await triggerAlertNotification(tenantId, tenant.companyName, totalTradedLots, limitLots, 80);
    } else if (utilizationPercentage < 80) {
      // Reset alert flags if usage resets (e.g. at the start of a new month)
      alertState.alert80 = false;
      alertState.alert100 = false;
    }

    return {
      tenantId: tenant.id,
      companyName: tenant.companyName,
      monthlyLimitLots: limitLots,
      totalTradedLots: totalTradedLots,
      utilizationPercentage: parseFloat(utilizationPercentage.toFixed(2)),
      is80PercentAlertSent: alertState.alert80,
      is100PercentAlertSent: alertState.alert100,
    };
  } catch (error) {
    console.error(`[METERING_ERROR] Failed tracking usage volume for ${tenantId}`, error);
    return null;
  }
}

/**
 * Triggers simulated multi-channel webhook alerts when volume thresholds are crossed.
 * Writes a critical audit log warning that displays in real-time on the Admin Panel.
 */
async function triggerAlertNotification(
  tenantId: string,
  companyName: string,
  totalTraded: number,
  limit: number,
  threshold: number
): Promise<void> {
  const subject = `CRITICAL: Lot Volume Utilization ${threshold}% reached for ${companyName}`;
  const message = `Tenant "${companyName}" (${tenantId}) has traded ${totalTraded.toFixed(2)} lots, crossing the ${threshold}% limit of ${limit.toFixed(2)} monthly allowed lots.`;

  console.log(`\n================== METERING ALERT: ${threshold}% ==================`);
  console.log(`[CHANNEL: EMAIL] Sent to: support@${companyName.toLowerCase().replace(/[^a-z]/g, '')}.com`);
  console.log(`[CHANNEL: TELEGRAM] Alert sent to Institutional Group: ${message}`);
  console.log(`[CHANNEL: WEBHOOK] POST to: https://api.billing-meter.com/webhooks/alerts - Status: 200 OK`);
  console.log(`============================================================\n`);

  // Write to database audit logs
  await prisma.auditLog.create({
    data: {
      tenantId: tenantId,
      eventType: 'BILLING_ALERT',
      logLevel: threshold === 100 ? 'CRITICAL' : 'WARN',
      message: message,
      metadata: {
        threshold: threshold,
        totalTradedLots: totalTraded,
        limitLots: limit,
        channels: ['email', 'telegram', 'webhook'],
      },
    },
  });
}
