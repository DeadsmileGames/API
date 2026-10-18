import express from "express";
import rateLimit from "express-rate-limit";
import { errorCatalog, resolveLocale } from "./utils/publicErrors.js";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import hpp from "hpp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env.js";
import { pool, directPool } from "./config/database.js";
import { csrfCookie, csrfToken, verifyCsrf } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { adminBodyLimiter } from "./middleware/bodyLimiter.js";
import { sendError } from "./utils/apiResponse.js";
import { authRouter } from "./routes/auth.routes.js";
import { gamesRouter } from "./routes/games.routes.js";
import { launcherRouter } from "./routes/launcher.routes.js";
import { searchRouter } from "./routes/search.routes.js";
import { accountRouter } from "./routes/account.routes.js";
import { newsletterRouter } from "./routes/newsletter.routes.js";
import { supportRouter } from "./routes/support.routes.js";
import { wishlistRouter } from "./routes/wishlist.routes.js";
import { preorderRouter } from "./routes/preorder.routes.js";
import {
  newsRouter,
  videosRouter,
  downloadsRouter,
  productsRouter,
  soundtracksRouter,
} from "./routes/content.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { specialThanksRouter } from "./routes/special-thanks.routes.js";
import { itchIntegrationRouter } from "./routes/itch-integration.routes.js";
import { libraryRouter } from "./routes/library.routes.js";
import { platformRouter } from "./routes/platform.routes.js";
import { linkPreviewRouter } from "./routes/link-preview.routes.js";
import { createServer } from "node:http";
import { attachRealtimeServer } from "./realtime/hub.js";

const PgSession = connectPgSimple(session);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cspDirectives() {
  const directives = {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    fontSrc: ["'self'", "data:"],
    connectSrc: ["'self'", ...env.frontendOrigins],
    mediaSrc: ["'self'", "blob:", "https:"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  };
  if (env.isProduction) directives.upgradeInsecureRequests = [];
  return directives;
}



export function createApp() {
  const app = express();
  app.use((req, res, next) => {
    res.locals.locale = resolveLocale(req.get("Accept-Language"));
    res.set("Content-Language", res.locals.locale);
    res.vary("Accept-Language");
    if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
    next();
  });
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  if (env.isProduction) app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: { directives: cspDirectives() },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      hsts: env.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      permittedCrossDomainPolicies: { permittedPolicies: "none" },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: "deny" },
      noSniff: true,
      originAgentCluster: true,
    }),
  );

  app.use((_req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
    next();
  });

  app.use(express.static(path.join(__dirname, "../public"), { index: false }));

  const allowedOrigins = env.isProduction
    ? env.frontendOrigins
    : [
        ...env.frontendOrigins,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:8081",
      ];
  const corsOptions = {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "Accept-Language", "Authorization"],
    maxAge: 600,
  };
  app.options("*", cors(corsOptions));
  app.use(cors(corsOptions));

  app.get("/api/health", rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
    handler: (_req, res) => sendError(res, 429, "RATE_LIMITED"),
  }), async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      await pool.query("SELECT 1");
      res.status(200).json({ status: "ok", service: "Deadsmile Games API" });
    } catch {
      res.status(503).json({ status: "unavailable", service: "Deadsmile Games API" });
    }
  });

  app.get("/api/time", (req, res) => {
    const epochMs = Date.now();
    const requestedTimeZone =
      typeof req.query.timeZone === "string" && req.query.timeZone.length <= 100
        ? req.query.timeZone.trim()
        : "";
    let timeZone = "UTC";
    if (requestedTimeZone) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: requestedTimeZone }).format(new Date(epochMs));
        timeZone = requestedTimeZone;
      } catch {
        // Unknown time zones fall back to UTC rather than trusting client clock data.
      }
    }
    const now = new Date(epochMs);
    const localTime = new Intl.DateTimeFormat(res.locals.locale || "en", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(now);
    res.set("Cache-Control", "no-store");
    res.json({
      success: true,
      data: {
        epochMs,
        utc: now.toISOString(),
        timeZone,
        localTime,
      },
    });
  });

  app.use(hpp());

  const standardJson = express.json({ limit: "2mb", strict: true });
  app.use((req, res, next) => {
    if (req.path === "/api/admin" || req.path.startsWith("/api/admin/")) return next();
    return standardJson(req, res, next);
  });

  app.use(cookieParser(env.sessionSecret));
  app.use(csrfCookie);
  const sessionOptions = {
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: false,
      pruneSessionInterval: 60 * 60,
    }),
    name: "deadsmile.sid",
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: env.cookieSameSite,
      maxAge: 7 * 24 * 60 * 60 * 1_000,
      partitioned: env.isProduction && env.cookieSameSite === "none",
      priority: "high",
    },
  };
  if (app.get("env") === "production") {
    sessionOptions.cookie.secure = true;
  }
  app.use(session(sessionOptions));

  app.use("/api", verifyCsrf);

  app.get("/api/errors", (_req, res) =>
    res.json({
      success: true,
      data: { locale: res.locals.locale, messages: errorCatalog(res.locals.locale) },
    }),
  );
  app.get("/api/csrf", csrfToken);
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminBodyLimiter, adminRouter);
  app.use("/api/special-thanks", specialThanksRouter);
  app.use("/api/games", gamesRouter);
  app.use("/api/launcher", launcherRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/account", accountRouter);
  app.use("/api/newsletter", newsletterRouter);
  app.use("/api/support", supportRouter);
  app.use("/api/newswire", newsRouter);
  app.use("/api/news", newsRouter);
  app.use("/api/videos", videosRouter);
  app.use("/api/soundtracks", soundtracksRouter);
  app.use("/api/downloads", downloadsRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/wishlist", wishlistRouter);
  app.use("/api/preorders", preorderRouter);
  app.use("/api/integrations/itch", itchIntegrationRouter);
  app.use("/api/library", libraryRouter);
  app.use("/api/platform", platformRouter);
  app.use("/api/link-preview", linkPreviewRouter);
  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

const server = createServer(app);

const realtime = attachRealtimeServer(server);

if (!process.env.VERCEL) {
  server.listen(env.port);
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    for (const connection of realtime.clients)
      connection.close(1001, "Service restarting");
    server.close(async () => {
      try {
        await Promise.all([
          pool.end(),
          ...(directPool !== pool ? [directPool.end()] : []),
        ]);
        process.exit(0);
      } catch {
        process.exit(1);
      }
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

export default server;
