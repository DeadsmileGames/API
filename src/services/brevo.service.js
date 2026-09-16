import { BrevoClient } from '@getbrevo/brevo';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const brevo = env.brevoApiKey
  ? new BrevoClient({
      apiKey: env.brevoApiKey,
      timeoutInSeconds: 15,
      maxRetries: 2,
    })
  : null;

export async function sendTransactionalEmail({
  to,
  subject,
  text,
  html,
}) {
  if (!brevo) {
    throw new AppError(
      500,
      'EMAIL_NOT_CONFIGURED',
      'Email service is temporarily unavailable.',
    );
  }

  if (!env.brevoSenderEmail) {
    throw new AppError(
      500,
      'EMAIL_NOT_CONFIGURED',
      'Email service is temporarily unavailable.',
    );
  }

  if (!to) {
    throw new AppError(
      500,
      'EMAIL_INVALID_RECIPIENT',
      'Email recipient is invalid.',
    );
  }

  try {
    const result =
      await brevo.transactionalEmails.sendTransacEmail({
        subject,
        textContent: text,
        htmlContent: html,
        sender: {
          name: env.brevoSenderName,
          email: env.brevoSenderEmail,
        },
        to: [
          {
            email: to,
          },
        ],
      });

    return {
      sent: true,
      messageId: result?.messageId ?? null,
    };
  } catch {
    throw new AppError(
      502,
      'EMAIL_SEND_FAILED',
      'Unable to send the email right now. Please try again later.',
    );
  }
}