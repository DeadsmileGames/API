import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  recaptchaToken: z.string().trim().min(1, 'reCAPTCHA verification is required.'),
}).strict();

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(32).max(128),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password is too long.')
    .regex(/[A-Za-z]/, 'Password must include at least one letter.')
    .regex(/[0-9]/, 'Password must include at least one number.'),
}).strict();