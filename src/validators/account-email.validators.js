import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

export const emailTokenSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

export const resendEmailSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
}).strict();

export const changeEmailSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
}).strict();

export const privacySchema = z.object({
  shareGameActivity: z.boolean(),
  sharePlaytime: z.boolean(),
  shareAchievements: z.boolean(),
}).strict();