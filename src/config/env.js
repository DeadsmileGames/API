import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function validAppUrl(name, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  const localHttp = !isProduction && url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if ((!localHttp && url.protocol !== 'https:') || url.username || url.password) {
    throw new Error(`${name} must use HTTPS, except localhost during development, and cannot contain credentials.`);
  }
  return url.origin;
}

const cookieSameSite = String(process.env.COOKIE_SAMESITE || (isProduction ? 'none' : 'lax')).toLowerCase();
if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
  throw new Error('COOKIE_SAMESITE must be one of: lax, strict, none');
}

const sessionSecret = required('SESSION_SECRET');
if (sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters long.');
}

const frontendUrl = validAppUrl('FRONTEND_URL', process.env.FRONTEND_URL || 'https://deadsmilegames.vercel.app');
const backendUrl = validAppUrl('BACKEND_URL', process.env.BACKEND_URL || 'https://deadsmile.vercel.app');

export const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 5000,
  databaseUrl: required('DATABASE_URL'),
  databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED || '',
  frontendUrl,
  backendUrl,
  resendApiKey: process.env.RESEND_API_KEY,
  notifyEmail: process.env.NOTIFY_EMAIL,
  sessionSecret,
  recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY,
  cookieSameSite,
  brevoApiKey: process.env.BREVO_API_KEY,
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL,
  brevoSenderName: process.env.BREVO_SENDER_NAME || 'Deadsmile Games',
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || '',
  itchClientId: process.env.ITCH_CLIENT_ID || '',
  itchLauncherClientId: process.env.ITCH_LAUNCHER_CLIENT_ID || '',
  itchTokenEncryptionKey: process.env.ITCH_TOKEN_ENCRYPTION_KEY || '',
  itchRedirectUri: process.env.ITCH_REDIRECT_URI || '',
  githubGameRepository: process.env.GITHUB_GAMES_REPO || '',
  githubGameToken: process.env.GITHUB_GAMES_TOKEN || '',
};
