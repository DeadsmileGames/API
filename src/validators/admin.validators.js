import { z } from 'zod';
import { isHttpsUrl, isItchHttpsUrl, isSafeRelativePath } from '../utils/url.js';

const imageUrl = z.string().trim().max(2_000).refine(
  (value) => !value || isHttpsUrl(value) || isSafeRelativePath(value),
  'Use an HTTPS URL without credentials or a safe relative path for images.',
).optional().nullable();

const httpsUrl = z.string().trim().max(2_000).refine(
  (value) => !value || isHttpsUrl(value),
  'URL must use HTTPS and cannot contain credentials.',
).optional().nullable();

const itchPurchaseUrl = z.string().trim().max(2_000).refine(
  (value) => !value || isItchHttpsUrl(value),
  'Use an HTTPS itch.io URL without credentials.',
).optional().nullable();

export const adminIdSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const newsletterPostSchema = z.object({
  title: z.string().trim().min(2).max(180),
  excerpt: z.string().trim().max(500).optional().default(''),
  body: z.string().trim().min(1).max(30_000),
  image: imageUrl,
}).strict();

export const videoPostSchema = z.object({
  title: z.string().trim().min(2).max(180),
  category: z.string().trim().min(1).max(80),
  thumbnail: imageUrl,
  videoUrl: httpsUrl,
  durationSeconds: z.coerce.number().int().min(0).max(86_400).optional().nullable(),
}).strict();

export const gamePostSchema = z.object({
  title: z.string().trim().min(2).max(180),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  shortDescription: z.string().trim().min(1).max(500),
  description: z.string().trim().max(30_000).optional().default(''),
  status: z.enum(['announced', 'in_development', 'released']).default('announced'),
  releaseDate: z.string().date().optional().nullable(),
  heroImage: imageUrl,
  coverImage: imageUrl,
  trailerUrl: httpsUrl,
  featured: z.boolean().default(false),
  genres: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
  platforms: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
  purchaseUrl: itchPurchaseUrl,
  itchGameId: z.coerce.number().int().positive().safe().optional().nullable(),
  downloadUrl: httpsUrl,
}).strict().superRefine((data, ctx) => {
  if (Boolean(data.purchaseUrl) !== Boolean(data.itchGameId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: data.purchaseUrl ? ['itchGameId'] : ['purchaseUrl'],
      message: 'Purchase URL and itch.io game ID must be provided together.',
    });
  }
});
