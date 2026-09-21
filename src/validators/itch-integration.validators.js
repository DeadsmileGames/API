import { z } from 'zod';

export const connectItchSchema = z.object({
  client: z.enum(['site', 'launcher']),
  locale: z.enum(['en', 'pt-BR', 'es']).default('en'),
  returnPath: z
    .string()
    .trim()
    .max(240)
    .regex(/^\/(?:account|games(?:\/[a-z0-9-]+)?)$/, 'Invalid return path.')
    .optional()
    .nullable(),
}).strict();

export const completeItchSchema = z.object({
  state: z.string().min(40).max(200),
  accessToken: z.string().min(20).max(1_000),
}).strict();

export const libraryGameSchema = z.object({
  gameId: z.string().uuid(),
}).strict();
