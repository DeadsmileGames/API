import { z } from 'zod';

export const totpTokenSchema = z.object({
  token: z.string().length(6).regex(/^\d+$/, 'Must be 6 digits.'),
});