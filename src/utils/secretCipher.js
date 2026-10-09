import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

function deriveKey(purpose, version) {
  return crypto.scryptSync(version === 'v2' ? env.dataEncryptionKey || env.sessionSecret : env.sessionSecret, `deadsmile:${purpose}:${version}`, 32);
}

export function encryptSecret(value, purpose) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(purpose, 'v2'), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return ['enc', 'v2', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSecret(value, purpose) {
  const source = String(value || '');
  if (!/^enc\.v[12]\./.test(source)) return source;
  try {
    const parts = source.split('.');
    if (parts.length !== 5) throw new Error();
    const [prefix, version, iv, tag, encrypted] = parts;
    if (prefix !== 'enc' || !['v1', 'v2'].includes(version) || !iv || !tag || !encrypted) throw new Error('invalid secret');
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(purpose, version), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new AppError(503, 'SECRET_DECRYPT_FAILED');
  }
}
