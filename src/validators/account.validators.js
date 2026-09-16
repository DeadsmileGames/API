import { z } from 'zod';
import { isHttpsUrl, isSafeRelativePath } from '../utils/url.js';

const httpsUrl = z
  .string()
  .trim()
  .max(2_000)
  .refine((value) => !value || isHttpsUrl(value), 'URL must use HTTPS and cannot contain credentials.')
  .or(z.literal(''))
  .optional();

const avatarUrl = z
  .string()
  .trim()
  .max(500_000)
  .refine(
    (value) => !value
      || /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
      || isHttpsUrl(value)
      || isSafeRelativePath(value),
    'Avatar must be a supported image data URL, HTTPS URL, or relative path.',
  )
  .optional()
  .nullable();

export const updateAccountSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  bio: z.string().trim().max(500).optional(),
  websiteUrl: httpsUrl,
  location: z.string().trim().max(120).optional(),
  avatarUrl,
}).strict();

export const deleteAccountSchema = z.object({
  password: z.string().min(8).max(128),
}).strict();

export const publicProfileSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
}).strict();
