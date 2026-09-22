import { z } from 'zod';

const uuid = z.string().uuid();

export const eventQuerySchema = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const pushSubscriptionSchema = z.object({
  token: z.string().trim().min(20).max(220),
  platform: z.enum(['android', 'ios']),
  deviceId: z.string().trim().max(160).optional(),
}).strict();

export const gameIdSchema = z.object({ gameId: uuid }).strict();

export const sessionStartSchema = z.object({
  gameId: uuid,
  launcherVersion: z.string().trim().max(40).optional().nullable(),
  gameVersion: z.string().trim().max(40).optional().nullable(),
  platform: z.enum(['windows', 'linux', 'macos']).default('windows'),
}).strict();

export const sessionIdSchema = z.object({ sessionId: uuid }).strict();

export const sessionEndSchema = z.object({
  durationMs: z.coerce.number().int().min(0).max(86_400_000).optional(),
}).strict();

export const achievementSchema = z.object({
  gameId: uuid,
  key: z.string().trim().regex(/^[a-z0-9_]{2,80}$/),
}).strict();

export const saveParamsSchema = z.object({
  gameId: uuid,
  slot: z.string().trim().regex(/^[a-z0-9_-]{1,40}$/),
}).strict();

export const saveBodySchema = z.object({
  payload: z.string().min(1).max(350_000),
  revision: z.coerce.number().int().positive().optional().nullable(),
  expectedUserId: uuid.optional(),
}).strict();

export const consentSchema = z.object({ enabled: z.boolean() }).strict();

export const telemetrySchema = z.object({
  gameId: uuid.optional().nullable(),
  sessionId: uuid.optional().nullable(),
  eventType: z.enum(['launcher_crash', 'game_crash', 'install_failed', 'update_failed']),
  appVersion: z.string().trim().max(40).optional().nullable(),
  payload: z.record(
    z.string().min(1).max(64),
    z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]),
  ).refine((value) => Object.keys(value).length <= 50, 'Telemetry payload has too many fields.').optional().default({}),
}).strict();
