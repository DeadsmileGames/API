import { z } from "zod";

export const specialThanksPostSchema = z
  .object({
    name: z.string().trim().min(1).max(100).refine(
      (value) => !Array.from(value).some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      }),
      "Name must not contain control characters.",
    ),
  })
  .strict();
