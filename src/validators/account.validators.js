import { z } from 'zod';

const httpsUrl = z
  .string()
  .trim()
  .max(2_000)
  .url()
  .refine((v) => v.startsWith('https://'), 'URL must use HTTPS.')
  .or(z.literal(''))
  .optional();

const avatarUrl = z
  .string()
  .trim()
  .max(500_000)
  .refine(
    (v) => !v || v.startsWith('data:image/') || v.startsWith('https://') || v.startsWith('/'),
    'Avatar must be a data URL, HTTPS URL, or relative path.'
  )
  .optional()
  .nullable();

export const updateAccountSchema = z
  .object({
    username:   z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).optional(),
    email:      z.string().trim().toLowerCase().email().max(254).optional(),
    bio:        z.string().trim().max(500).optional(),
    websiteUrl: httpsUrl,
    location:   z.string().trim().max(120).optional(),
    avatarUrl,
  })
  .strict();

export const deleteAccountSchema = z
  .object({
    password: z.string().min(8).max(128),
  })
  .strict();
