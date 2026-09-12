import { z } from 'zod';

export const contentListSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const contentSlugSchema = z.object({
  slug: z.string().min(1).max(160),
});
