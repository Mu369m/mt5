/**
 * @file backend/src/notifications.ts
 * @description Non-blocking multi-channel alert delivery for operational and risk events.
 * Channels are opt-in through environment variables and never block trade execution.
 */

export interface AlertMessage {
  subject: string;
  text: string;
  severity: 'WARN' | 'CRITICAL';
}

async function postJson(url: string, body: unknown, authorization?: string): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Notification provider returned ${response.status}`);
}

export async function dispatchAlert(message: AlertMessage): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (process.env.ALERT_WEBHOOK_URL) jobs.push(postJson(process.env.ALERT_WEBHOOK_URL, message));
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    jobs.push(postJson(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: `${message.subject}\n\n${message.text}`,
    }));
  }
  if (process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TO) {
    jobs.push(postJson(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      messaging_product: 'whatsapp',
      to: process.env.WHATSAPP_TO,
      type: 'text',
      text: { body: `${message.subject}\n\n${message.text}` },
    }, `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`).catch(() => undefined));
  }
  const results = await Promise.allSettled(jobs);
  for (const result of results) {
    if (result.status === 'rejected') console.error('[ALERT_DELIVERY_FAILED]', result.reason);
  }
}
