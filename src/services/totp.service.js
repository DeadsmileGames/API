import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import * as repo from '../repositories/totp.repository.js';
import { AppError } from '../utils/AppError.js';

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
    name: `DEADSMILE:${email}`,
    length: 20,
  });

  const otpauthUrl = secret.otpauth_url;
  if (!otpauthUrl) {
    throw new AppError(500, 'TOTP_SETUP_FAILED', 'Unable to generate the 2FA setup code.');
  }

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  await repo.upsertTotpSecret(userId, secret.base32);

  return { secret: secret.base32, qrCodeDataUrl, enabled: false };
}

export async function verifyAndEnableTotp(userId, token) {
  const totp = await repo.findTotpByUserId(userId);
  if (!totp) throw new AppError(404, 'TOTP_NOT_SETUP', '2FA not set up.');
  if (totp.enabled) throw new AppError(409, 'TOTP_ALREADY_ENABLED', '2FA is already enabled.');

  const verified = speakeasy.totp.verify({
    secret: totp.secret,
    encoding: 'base32',
    token,
    window: 1,
  });

  if (!verified) throw new AppError(400, 'INVALID_TOTP', 'Invalid 2FA code.');

  await repo.enableTotp(userId);
  return { enabled: true };
}

export async function disableTotp(userId, token) {
  const totp = await repo.findTotpByUserId(userId);
  if (!totp) throw new AppError(404, 'TOTP_NOT_SETUP', '2FA not set up.');

  if (totp.enabled) {
    const verified = speakeasy.totp.verify({
      secret: totp.secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) throw new AppError(400, 'INVALID_TOTP', 'Invalid 2FA code.');
  }

  await repo.disableTotp(userId);
  return { disabled: true };
}

export async function verifyTotpLogin(userId, token) {
  const totp = await repo.findTotpByUserId(userId);
  if (!totp?.enabled) return false;

  return speakeasy.totp.verify({
    secret: totp.secret,
    encoding: 'base32',
    token,
    window: 1,
  });
}
