import { z } from 'zod';
import { isHttpsUrl, isSafeRelativePath } from '../utils/url.js';

const uuid = z.string().uuid();
const httpsUrl = z.string().trim().max(2_000).refine(
  (value) => isHttpsUrl(value),
  'URL must use HTTPS and cannot contain credentials.',
);
const imageUrl = z.string().trim().max(2_000).refine(
  (value) => isHttpsUrl(value) || isSafeRelativePath(value),
  'Use an HTTPS URL without credentials or a safe relative path.',
);

export const channelSchema = z.object({
  gameId: uuid,
  name: z.enum(['stable', 'beta', 'internal']),
  label: z.string().trim().min(2).max(60),
  public: z.boolean().default(false),
}).strict();

export const buildSchema = z.object({
  gameId: uuid,
  channelId: z.coerce.number().int().positive().safe(),
  version: z.string().trim().min(1).max(40),
  platform: z.enum(['windows', 'linux', 'macos']),
  architecture: z.string().trim().min(2).max(20).regex(/^[a-zA-Z0-9_-]+$/).default('x64'),
  itchChannel: z.string().trim().max(120).regex(/^[a-zA-Z0-9._-]+$/).optional().nullable(),
  downloadUrl: httpsUrl.optional().nullable(),
  sha256: z.string().trim().regex(/^[a-f0-9]{64}$/).optional().nullable(),
  sizeBytes: z.coerce.number().int().min(0).safe().optional().nullable(),
  notes: z.string().trim().max(10_000).optional().default(''),
  status: z.enum(['draft', 'published', 'retired']).default('draft'),
}).strict().superRefine((data, ctx) => {
  if (data.status !== 'published') return;
  if (!data.itchChannel && !data.downloadUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['itchChannel'],
      message: 'Published builds require an itch.io channel or a direct HTTPS download URL.',
    });
  }
  if (data.downloadUrl && !data.sha256) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sha256'],
      message: 'Direct published downloads require a SHA-256 checksum.',
    });
  }
  if (data.downloadUrl && !(Number(data.sizeBytes) > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sizeBytes'],
      message: 'Direct published downloads require a positive file size.',
    });
  }
});

export const achievementAdminSchema = z.object({
  gameId: uuid,
  key: z.string().trim().regex(/^[a-z0-9_]{2,80}$/),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(''),
  iconUrl: imageUrl.optional().nullable(),
  points: z.coerce.number().int().min(0).max(1000).default(0),
  hidden: z.boolean().default(false),
}).strict();

export const betaSchema = z.object({
  userId: uuid,
  gameId: uuid,
  channelId: z.coerce.number().int().positive().safe(),
  expiresAt: z.string().datetime().optional().nullable(),
}).strict().superRefine((data, ctx) => {
  if (data.expiresAt && Date.parse(data.expiresAt) <= Date.now()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Beta access expiration must be in the future.' });
  }
});

export const incidentSchema = z.object({
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().max(5_000).optional().default(''),
  severity: z.enum(['notice', 'degraded', 'outage']),
  status: z.enum(['investigating', 'monitoring', 'resolved']).default('investigating'),
}).strict();
