import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import hpp from "hpp";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "./config/env.js";
import { pool } from "./config/database.js";
import { csrfCookie, csrfToken, verifyCsrf } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { adminBodyLimiter } from "./middleware/bodyLimiter.js";

import { authRouter } from "./routes/auth.routes.js";
import { gamesRouter } from "./routes/games.routes.js";
import { searchRouter } from "./routes/search.routes.js";
import { accountRouter } from "./routes/account.routes.js";
import { newsletterRouter } from "./routes/newsletter.routes.js";
import { supportRouter } from "./routes/support.routes.js";
import { wishlistRouter } from './routes/wishlist.routes.js';
import {
    newsRouter,
    videosRouter,
    downloadsRouter,
    productsRouter,
} from "./routes/content.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { itchIntegrationRouter } from "./routes/itch-integration.routes.js";
import { libraryRouter } from "./routes/library.routes.js";

const PgSession = connectPgSimple(session);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSP_DIRECTIVES = {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://cdn.jsdelivr.net",
    ],

    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],

    fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://fonts.scalar.com",
    ],

    connectSrc: ["'self'", "https://api.scalar.com", env.frontendUrl],
    mediaSrc: ["'self'", "blob:", "https:"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: env.isProduction ? [] : [],
};

const SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
    partitioned: env.isProduction,
};

export function createApp() {
    const app = express();

    app.use(
        express.static(path.join(__dirname, "../public"), {
            index: false,
        }),
    );

    if (env.isProduction) {
        app.set("trust proxy", 1);
    }

    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: CSP_DIRECTIVES,
            },

            crossOriginEmbedderPolicy: true,

            crossOriginOpenerPolicy: {
                policy: "same-origin",
            },

            crossOriginResourcePolicy: {
                policy: "cross-origin",
            },

            referrerPolicy: {
                policy: "strict-origin-when-cross-origin",
            },

            hsts: env.isProduction
                ? {
                      maxAge: 31_536_000,
                      includeSubDomains: true,
                      preload: true,
                  }
                : false,

            permittedCrossDomainPolicies: {
                permittedPolicies: "none",
            },

            dnsPrefetchControl: {
                allow: false,
            },

            frameguard: {
                action: "deny",
            },

            noSniff: true,

            xssFilter: true,

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

    const allowedOrigins = [
      env.frontendUrl,
      'http://localhost:5173',
      'http://localhost:8081',
    ];

    app.options("*", cors({
        origin: allowedOrigins,
        credentials: true,
        }));

    app.use(
      cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "X-CSRF-Token"],
      })
    );
    app.use(hpp());

    app.use(
        express.json({
            limit: "2mb",
        }),
    );

    app.use(cookieParser());
    app.use(csrfCookie);

    app.use(
        session({
            store: new PgSession({
                pool,
                tableName: "user_sessions",
                createTableIfMissing: true,
                pruneSessionInterval: 60 * 60,
            }),
            name: "deadsmile.sid",
            secret: env.sessionSecret,
            resave: false,
            saveUninitialized: false,
            cookie: SESSION_COOKIE_OPTIONS,
        }),
    );
    app.get("/api/csrf", csrfToken);

    app.use("/api", verifyCsrf);

    app.get("/api/health", (_req, res) => {
        res.status(200).json({
            status: "ok",
            service: "API Documentation",
            environment: process.env.NODE_ENV || "development",
        });
    });

    app.use("/api/auth", authRouter);
    app.use("/api/admin", adminBodyLimiter, adminRouter);
    app.use("/api/games", gamesRouter);
    app.use("/api/search", searchRouter);
    app.use("/api/account", accountRouter);
    app.use("/api/newsletter", newsletterRouter);
    app.use("/api/support", supportRouter);
    app.use("/api/news", newsRouter);
    app.use("/api/videos", videosRouter);
    app.use("/api/downloads", downloadsRouter);
    app.use("/api/products", productsRouter);
    app.use("/api/wishlist", wishlistRouter);
    app.use("/api/integrations/itch", itchIntegrationRouter);
    app.use("/api/library", libraryRouter);

    app.use("/api", notFoundHandler);
    app.use(errorHandler);

    return app;
}
const app = createApp();

export default app;
