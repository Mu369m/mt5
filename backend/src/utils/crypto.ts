/**
 * @file backend/src/utils/crypto.ts
 * @description Native cryptographic utilities implementing AES-256-CBC symmetric encryption
 * to securely store LP / MetaTrader login passwords in the database.
 * 
 * Connected Modules:
 * - backend/src/routes/destinations.ts (encrypts password on write/update)
 * - mt-bridge/src/engine.ts (decrypts password to establish connections)
 */

import crypto from 'crypto';

// The key must be exactly 32 bytes (256 bits)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '32-character-encryption-key-for-aes-256-cbc-12345';
const IV_LENGTH = 16; // AES block size in bytes

/**
 * Encrypts cleartext using AES-256-CBC.
 * Returns a colon-separated string: "iv_hex:ciphertext_hex"
 * 
 * @param text - The cleartext password to encrypt.
 */
export function encrypt(text: string): string {
  if (!text) return '';
  
  // Make sure key length is exactly 32 bytes
  let key = Buffer.from(ENCRYPTION_KEY, 'utf-8');
  if (key.length !== 32) {
    // Standardize key size if environment key is too short or too long
    key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a hex string formatted as "iv_hex:ciphertext_hex" back into cleartext.
 * 
 * @param cipherText - Encrypted ciphertext.
 */
export function decrypt(cipherText: string): string {
  if (!cipherText) return '';
  
  const parts = cipherText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid ciphertext format structure');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = Buffer.from(parts[1], 'hex');
  
  let key = Buffer.from(ENCRYPTION_KEY, 'utf-8');
  if (key.length !== 32) {
    key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  }

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}
