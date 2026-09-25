import crypto from 'node:crypto';

import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';
import { query } from '../config/database.js';
import { verifyPassword } from '../utils/password.js';

import {
  findUserByEmail,
  findUserById,
} from '../repositories/users.repository.js';

import {
  createPendingEmailToken,
  deleteUnsentToken,
  confirmEmailToken,
} from '../repositories/account-email.repository.js';

import { sendTransactionalEmail } from './brevo.service.js';
import { escapeHtml } from '../utils/html.js';

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');
async function deliverConfirmation({
  userId,
  purpose,
  email,
}) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(token);

  const saved = await createPendingEmailToken({
    userId,
    purpose,
    email,
    hash: tokenHash,
    expiresAt: new Date(Date.now() + 30 * 60_000),
  });

  if (!saved) {
    throw new AppError(
      429,
      'EMAIL_CONFIRMATION_COOLDOWN',
      'Please wait one minute before requesting another confirmation email.',
    );
  }

  const url =
    `${env.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const label = purpose === 'change'
    ? 'Confirm your new email address'
    : 'Confirm your account email';

  try {
    await sendTransactionalEmail({
      to: email,

      subject: `${label} — Deadsmile Games`,

      text:
        `${label}:\n\n${url}\n\n` +
        'This link expires in 30 minutes and can only be used once. ' +
        'If you did not request it, ignore this email.',

      html: `
        <div style="
          font-family:Arial,sans-serif;
          background:#0b0b0b;
          color:#f5f1e8;
          padding:32px;
          max-width:560px;
          margin:auto;
          border-radius:18px;
        ">
          <h1>${label}</h1>

          <p>
            Use this link to verify your address.
            It expires in 30 minutes.
          </p>

          <a
            href="${escapeHtml(url)}"
            style="
              display:inline-block;
              background:#f5f1e8;
              color:#0b0b0b;
              padding:13px 20px;
              border-radius:999px;
            "
          >
            Confirm email
          </a>

          <p>
            If you did not request this, ignore this message.
          </p>
        </div>
      `,
    });
  } catch (error) {
    await deleteUnsentToken(userId, tokenHash);
    throw error;
  }
}
export async function sendRegistrationEmail(user) {
  await deliverConfirmation({
    userId: user.id,
    purpose: 'register',
    email: user.email,
  });
}
export async function resendRegistrationEmail({
  email,
  password,
}) {
  const user = await findUserByEmail(email);

  if (!user) {
    return { sent: true };
  }

  const valid = await verifyPassword(
    user.password_hash,
    password,
  );

  if (!valid || user.email_verified_at) {
    return { sent: true };
  }

  await sendRegistrationEmail(user);

  return { sent: true };
}
export async function requestEmailChange(
  userId,
  { email, password },
) {
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError(
      404,
      'USER_NOT_FOUND',
      'Account not found.',
    );
  }

  if (!user.email_verified_at) {
    throw new AppError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Confirm your current email before changing it.',
    );
  }

  if (email === user.email) {
    throw new AppError(
      400,
      'EMAIL_UNCHANGED',
      'Enter a different email address.',
    );
  }
  const { rows } = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId],
  );

  if (
    !rows[0] ||
    !await verifyPassword(rows[0].password_hash, password)
  ) {
    throw new AppError(
      401,
      'INVALID_PASSWORD',
      'Current password is incorrect.',
    );
  }

  const existing = await findUserByEmail(email);

  if (existing) {
    throw new AppError(
      409,
      'EMAIL_TAKEN',
      'That email is already registered.',
    );
  }
  await deliverConfirmation({
    userId,
    purpose: 'change',
    email,
  });
  await sendTransactionalEmail({
    to: user.email,
    subject: 'Email change requested — Deadsmile Games',

    text:
      `A request was made to change your Deadsmile Games ` +
      `account email to ${email}.\n\n` +
      `Your current email remains unchanged until the ` +
      `new address is confirmed.\n\n` +
      `If this was not you, change your password ` +
      `and contact support.`,

    html: `
      <p>
        A request was made to change your Deadsmile Games
        email to ${escapeHtml(email)}.
      </p>

      <p>
        Your current email has not changed.
      </p>

      <p>
        If this was not you, change your password
        and contact support.
      </p>
    `,
  }).catch((error) => {
    console.error('Old-address notification failed', {
      code: error?.code || null,
    });
  });

  return { pending: true };
}
export async function confirmAccountEmail(rawToken) {
  const result = await confirmEmailToken(sha256(rawToken));

  if (!result || result.conflict) {
    throw new AppError(
      400,
      'EMAIL_CONFIRMATION_INVALID',
      'This email confirmation link is invalid or expired.',
    );
  }

  if (result.purpose === 'change') {
    await sendTransactionalEmail({
      to: result.oldEmail,

      subject: 'Your account email was changed — Deadsmile Games',

      text:
        `Your Deadsmile Games account email was changed ` +
        `to ${result.newEmail}.\n\n` +
        `If this was not you, contact support immediately ` +
        `and reset your password.`,

      html: `
        <p>
          Your Deadsmile Games account email was changed
          to ${escapeHtml(result.newEmail)}.
        </p>

        <p>
          If this was not you, contact support immediately
          and reset your password.
        </p>
      `,
    }).catch((error) => {
      console.error('Email change notification failed', {
        code: error?.code || null,
      });
    });
  }

  return {
    verified: true,
    emailChanged: result.purpose === 'change',
  };
}