import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password is too long.')
  .regex(
    /[A-Za-z]/,
    'Password must include at least one letter.'
  )
  .regex(
    /[0-9]/,
    'Password must include at least one number.'
  );

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(24, 'Username must be at most 24 characters.')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username may only contain letters, numbers, and underscores.'
    ),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.')
    .max(254),

  password: passwordSchema,
});

export const mobileLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.')
    .max(254),

  password: z
    .string()
    .min(1, 'Password is required.')
    .max(128),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.')
    .max(254),

  password: z
    .string()
    .min(1, 'Password is required.')
    .max(128),

  recaptchaToken: z
    .string()
    .trim()
    .min(1, 'reCAPTCHA verification is required.'),
});

export const mobileRegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(24, 'Username must be at most 24 characters.')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username may only contain letters, numbers, and underscores.'
    ),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.')
    .max(254),

  password: passwordSchema,
});
