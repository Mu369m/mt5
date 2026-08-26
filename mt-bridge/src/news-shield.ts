/**
 * @file mt-bridge/src/news-shield.ts
 * @description Proprietary Feature C: News Volatility Auto-Shield.
 * Syncs upcoming macro economic announcements (NFP, CPI, FOMC) and escalates per-symbol markups
 * (+25 points) during a +/- 2-minute volatility shield window.
 * 
 * Connected Modules:
 * - mt-bridge/src/engine.ts (evaluates markup scaling factors on execution)
 */

interface NewsEvent {
  id: string;
  title: string;
  country: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: number; // Unix Epoch MS
}

// In-memory calendar cache for high-impact economic news releases
let economicCalendar: NewsEvent[] = [];

/**
 * Seeds or syncs the economic calendar with simulation schedules.
 * Generates news releases occurring in the future relative to server boot time
 * to verify volatility shield adjustments during sandbox executions.
 */
export function syncEconomicCalendar(): void {
  const now = Date.now();
  
  // Seed sample events: e.g. NFP coming up in 5 minutes, FOMC in 15 minutes
  economicCalendar = [
    {
      id: 'nfp-usd',
      title: 'Non-Farm Employment Change (NFP)',
      country: 'USD',
      impact: 'HIGH',
      timestamp: now + 5 * 60 * 1000, // 5 minutes from now
    },
    {
      id: 'cpi-usd',
      title: 'CPI m/m (Inflation Core)',
      country: 'USD',
      impact: 'HIGH',
      timestamp: now + 12 * 60 * 1000, // 12 minutes from now
    },
    {
      id: 'fomc-usd',
      title: 'FOMC Interest Rate Decision',
      country: 'USD',
      impact: 'HIGH',
      timestamp: now + 25 * 60 * 1000, // 25 minutes from now
    },
  ];

  console.log(`[NEWS_SHIELD] Economic Calendar Synced. Loaded ${economicCalendar.length} high-impact macro announcements.`);
}

/**
 * Checks if the system is currently within the active News Volatility Shield window
 * (+/- 2 minutes relative to a high-impact calendar event timestamp).
 * 
 * @returns An object containing status and active news trigger names.
 */
export function checkNewsShieldWindow(): {
  isShieldActive: boolean;
  activeEvent: NewsEvent | null;
  secondsRemainingToRelease: number;
} {
  const now = Date.now();
  const shieldWindowMs = 2 * 60 * 1000; // 2 minutes

  for (const event of economicCalendar) {
    if (event.impact !== 'HIGH') continue;

    const timeDifference = event.timestamp - now;
    const isBeforeEvent = timeDifference > 0 && timeDifference <= shieldWindowMs;
    const isAfterEvent = timeDifference < 0 && Math.abs(timeDifference) <= shieldWindowMs;

    if (isBeforeEvent || isAfterEvent) {
      return {
        isShieldActive: true,
        activeEvent: event,
        secondsRemainingToRelease: Math.round(timeDifference / 1000),
      };
    }
  }

  return {
    isShieldActive: false,
    activeEvent: null,
    secondsRemainingToRelease: 0,
  };
}

/**
 * Manually inserts a custom news event timestamp (useful for onboarding testing).
 */
export function injectTestNewsEvent(title: string, delayMinutes: number): void {
  const now = Date.now();
  economicCalendar.push({
    id: `test-news-${now}`,
    title,
    country: 'ALL',
    impact: 'HIGH',
    timestamp: now + delayMinutes * 60 * 1000,
  });
}
