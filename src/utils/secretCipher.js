import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

function deriveKey(purpose) {
  return crypto.scryptSync(env.sessionSecret, `deadsmile:${purpose}:v1`, 32);
}

export function encryptSecret(value, purpose) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(purpose), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return ['enc', 'v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSecret(value, purpose) {
  const source = String(value || '');
  if (!source.startsWith('enc.v1.')) return source;
  try {
    const [prefix, version, iv, tag, encrypted] = source.split('.');
    if (prefix !== 'enc' || version !== 'v1' || !iv || !tag || !encrypted) throw new Error('invalid secret');
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(purpose), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new AppError(503, 'SECRET_DECRYPT_FAILED', 'A protected account secret could not be read.');
  }
}
