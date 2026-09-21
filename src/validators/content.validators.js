import { z } from 'zod';

export const contentListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
}).strict();

export const contentSlugSchema = z.object({
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9-]+$/),
}).strict();

export const contentIdSchema = z.object({
  id: z.string().uuid(),
}).strict();
