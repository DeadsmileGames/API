import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import hpp from 'hpp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { pool } from './config/database.js';
import { csrfCookie, csrfToken, verifyCsrf } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { adminBodyLimiter } from './middleware/bodyLimiter.js';
import { authRouter } from './routes/auth.routes.js';
import { gamesRouter } from './routes/games.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { accountRouter } from './routes/account.routes.js';
import { newsletterRouter } from './routes/newsletter.routes.js';
import { supportRouter } from './routes/support.routes.js';
import { wishlistRouter } from './routes/wishlist.routes.js';
import { newsRouter, videosRouter, downloadsRouter, productsRouter } from './routes/content.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { itchIntegrationRouter } from './routes/itch-integration.routes.js';
import { libraryRouter } from './routes/library.routes.js';
import { platformRouter } from './routes/platform.routes.js';

const PgSession = connectPgSimple(session);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cspDirectives() {
  const directives = {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'", env.frontendUrl],
    mediaSrc: ["'self'", 'blob:', 'https:'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  };
  if (env.isProduction) directives.upgradeInsecureRequests = [];
  return directives;
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.cookieSameSite,
    maxAge: 7 * 24 * 60 * 60 * 1_000,
    partitioned: env.isProduction && env.cookieSameSite === 'none',
    priority: 'high',
  };
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  if (env.isProduction) app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: { directives: cspDirectives() },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: env.isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    noSniff: true,
    originAgentCluster: true,
  }));

  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    next();
  });

  app.use(express.static(path.join(__dirname, '../public'), { index: false }));

  const allowedOrigins = env.isProduction
    ? [env.frontendUrl]
    : [env.frontendUrl, 'http://localhost:5173', 'http://localhost:8081'];
  const corsOptions = {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    maxAge: 600,
  };
  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));
  app.use(hpp());

  const standardJson = express.json({ limit: '2mb', strict: true });
  app.use((req, res, next) => {
    if (req.path === '/api/admin' || req.path.startsWith('/api/admin/')) return next();
    return standardJson(req, res, next);
  });

  app.use(cookieParser());
  app.use(csrfCookie);
  app.use(session({
    store: new PgSession({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: false,
      pruneSessionInterval: 60 * 60,
    }),
    name: 'deadsmile.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: sessionCookieOptions(),
  }));

  app.get('/api/csrf', csrfToken);
  app.use('/api', verifyCsrf);

  app.get('/api/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ status: 'ok', service: 'Deadsmile Games API' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminBodyLimiter, adminRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/newsletter', newsletterRouter);
  app.use('/api/support', supportRouter);
  app.use('/api/news', newsRouter);
  app.use('/api/videos', videosRouter);
  app.use('/api/downloads', downloadsRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/wishlist', wishlistRouter);
  app.use('/api/integrations/itch', itchIntegrationRouter);
  app.use('/api/library', libraryRouter);
  app.use('/api/platform', platformRouter);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
