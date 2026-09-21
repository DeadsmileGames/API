import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import * as repo from '../repositories/totp.repository.js';
import { AppError } from '../utils/AppError.js';
import { decryptSecret, encryptSecret } from '../utils/secretCipher.js';

const PURPOSE = 'totp';

async function readableSecret(record) {
  if (!record?.secret) return null;
  const secret = decryptSecret(record.secret, PURPOSE);
  if (!String(record.secret).startsWith('enc.v1.')) {
    await repo.replaceTotpSecret(record.user_id, record.secret, encryptSecret(secret, PURPOSE));
  }
  return secret;
}

function verify(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });
}

export async function getTotpStatus(userId) {
  const totp = await repo.findTotpByUserId(userId);
  return { enabled: Boolean(totp?.enabled) };
}

export async function generateTotpSetup(userId, email) {
  const current = await repo.findTotpByUserId(userId);
  if (current?.enabled) {
    throw new AppError(409, 'TOTP_ALREADY_ENABLED', '2FA is already enabled on this account.');
  }

  const secret = speakeasy.generateSecret({
    name: `Deadsmile Games:${email}`,
    issuer: 'Deadsmile Games',
    length: 20,
  });

  if (!secret.otpauth_url) {
    throw new AppError(500, 'TOTP_SETUP_FAILED', 'Unable to generate the 2FA setup code.');
  }

  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url, { errorCorrectionLevel: 'M' });
  await repo.upsertTotpSecret(userId, encryptSecret(secret.base32, PURPOSE));
  return { secret: secret.base32, qrCodeDataUrl, enabled: false };
}

export async function verifyAndEnableTotp(userId, token) {
  const totp = await repo.findTotpByUserId(userId);
  if (!totp) throw new AppError(404, 'TOTP_NOT_SETUP', '2FA not set up.');
  if (totp.enabled) throw new AppError(409, 'TOTP_ALREADY_ENABLED', '2FA is already enabled.');

  const secret = await readableSecret(totp);
  if (!verify(secret, token)) throw new AppError(400, 'INVALID_TOTP', 'Invalid 2FA code.');
  await repo.enableTotp(userId);
  return { enabled: true };
}

export async function disableTotp(userId, token) {
  const totp = await repo.findTotpByUserId(userId);
  if (!totp) throw new AppError(404, 'TOTP_NOT_SETUP', '2FA not set up.');

  if (totp.enabled) {
    const secret = await readableSecret(totp);
    if (!verify(secret, token)) throw new AppError(400, 'INVALID_TOTP', 'Invalid 2FA code.');
  }

  await repo.disableTotp(userId);
  return { disabled: true };
}

export async function verifyTotpLogin(userId, token) {
  const totp = await repo.findTotpByUserId(userId);
  if (!totp?.enabled) return false;
  const secret = await readableSecret(totp);
  return verify(secret, token);
}
