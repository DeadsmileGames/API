import { z } from 'zod';

const boolFromQuery = z
  .union([z.literal('true'), z.literal('false')])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

export const listGamesSchema = z.object({
  page:     z.coerce.number().int().min(1).max(1_000).default(1),
  limit:    z.coerce.number().int().min(1).max(48).default(12),
  featured: boolFromQuery,
  genre:    z.string().trim().max(40).optional(),
  platform: z.string().trim().max(40).optional(),
  status:   z.enum(['announced', 'in_development', 'released']).optional(),
});

export const gameSlugSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Invalid game identifier.'),
});
