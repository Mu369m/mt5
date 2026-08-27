/**
 * @file backend/src/notifications.ts
 * @description Email-only alert delivery for operational and risk events.
 * Delivery is opt-in through SMTP environment variables and never blocks trade execution.
 */

import nodemailer from 'nodemailer';

export interface AlertMessage {
  subject: string;
  text: string;
  severity: 'WARN' | 'CRITICAL';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function getTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!host || !Number.isInteger(port) || port <= 0) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
}

export async function dispatchAlert(message: AlertMessage): Promise<void> {
  const transporter = getTransporter();
  const recipient = process.env.ALERT_EMAIL_TO;
  const sender = process.env.EMAIL_FROM;
  if (!transporter || !recipient || !sender) {
    console.warn('[EMAIL_ALERT_SKIPPED] Configure SMTP_HOST, EMAIL_FROM, and ALERT_EMAIL_TO');
    return;
  }

  await transporter.sendMail({
    from: sender,
    to: recipient,
    subject: message.subject,
    text: message.text,
    html: `<main style="font-family:Arial,sans-serif;line-height:1.5"><h2>${escapeHtml(message.subject)}</h2><p>${escapeHtml(message.text).replace(/\n/g, '<br>')}</p><small>Severity: ${escapeHtml(message.severity)}</small></main>`,
  });
}
