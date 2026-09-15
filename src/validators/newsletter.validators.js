import { z } from 'zod';

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
}).strict();

export const newsletterConfirmationTokenSchema = z.object({
  token: z.string().trim().regex(/^[a-f0-9]{64}$/i, 'This newsletter link is invalid.'),
}).strict();

export const newsletterUnsubscribeTokenSchema = z.object({
  token: z.string().trim().max(200).refine(
    (value) => /^[a-f0-9]{64}$/i.test(value) || /^v1\.[0-9a-f-]{36}\.[a-f0-9]{64}$/i.test(value),
    'This newsletter link is invalid.',
  ),
}).strict();
