import { z } from 'zod';

export const supportSchema = z.object({
  email:    z.string().trim().email('Enter a valid email address.').max(254),
  category: z.enum(['game', 'account', 'technical', 'faq', 'other']),
  message:  z.string().trim().min(10, 'Message must be at least 10 characters.').max(5_000),
});
