import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const nodeEnv       = process.env.NODE_ENV || 'development';
const isProduction  = nodeEnv === 'production';
const cookieSameSite = process.env.COOKIE_SAMESITE || (isProduction ? 'none' : 'lax');

if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
  throw new Error('COOKIE_SAMESITE must be one of: lax, strict, none');
}

const sessionSecret = required('SESSION_SECRET');
if (sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters long.');
}

export const env = {
  nodeEnv,
  isProduction,
  port:           Number(process.env.PORT) || 5000,
  databaseUrl:    required('DATABASE_URL'),
  frontendUrl:    process.env.FRONTEND_URL,
  backendUrl:     process.env.BACKEND_URL,
  resendApiKey: process.env.RESEND_API_KEY,
  notifyEmail: process.env.NOTIFY_EMAIL,
  sessionSecret,
  recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY,
  cookieSameSite,
  brevoApiKey: process.env.BREVO_API_KEY,
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL,
  brevoSenderName: process.env.BREVO_SENDER_NAME || 'DEADSMILE',
  itchClientId: process.env.ITCH_CLIENT_ID || '',
  itchApiKey: process.env.ITCH_API_KEY || '',
  itchTokenEncryptionKey: process.env.ITCH_TOKEN_ENCRYPTION_KEY || '',
  itchRedirectUri: process.env.ITCH_REDIRECT_URI || '',
};
