import { z } from 'zod';

export const searchSchema = z.object({
  q:     z.string().trim().min(1, 'Search query is required.').max(80, 'Search query is too long.'),
  page:  z.coerce.number().int().min(1).max(1_000).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(10),
});
