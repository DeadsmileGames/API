import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "../constants/legal.js";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.")
  .regex(/[A-Za-z]/, "Password must include at least one letter.")
  .regex(/[0-9]/, "Password must include at least one number.");

const dateOfBirthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth.")
  .refine((value) => {
    const date = new Date(value + "T00:00:00.000Z");
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value <= new Date().toISOString().slice(0, 10)
    );
  }, "Enter a valid date of birth.");

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters.")
      .max(24, "Username must be at most 24 characters.")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username may only contain letters, numbers, and underscores.",
      ),

    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
    dateOfBirth: dateOfBirthSchema,

    password: passwordSchema,

    recaptchaToken: z
      .string()
      .trim()
      .min(1, "reCAPTCHA verification is required.")
      .max(10_000, "reCAPTCHA token is too long."),

    termsAccepted: z.literal(true).optional(),
    privacyAcknowledged: z.literal(true).optional(),
    termsVersion: z.literal(CURRENT_TERMS_VERSION).optional(),
    privacyVersion: z.literal(CURRENT_PRIVACY_VERSION).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasAnyAcceptanceField = [
      value.termsAccepted,
      value.privacyAcknowledged,
      value.termsVersion,
      value.privacyVersion,
    ].some((field) => field !== undefined);

    if (process.env.REQUIRE_LEGAL_ACCEPTANCE === "false" && !hasAnyAcceptanceField) {
      return;
    }

    const requiredFields = [
      ["termsAccepted", value.termsAccepted, true],
      ["privacyAcknowledged", value.privacyAcknowledged, true],
      ["termsVersion", value.termsVersion, CURRENT_TERMS_VERSION],
      ["privacyVersion", value.privacyVersion, CURRENT_PRIVACY_VERSION],
    ];

    for (const [field, actual, expected] of requiredFields) {
      if (actual !== expected) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Current legal acceptance is required.",
        });
      }
    }
  });

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),

    password: z.string().min(1, "Password is required.").max(128),

    recaptchaToken: z
      .string()
      .trim()
      .min(1, "reCAPTCHA verification is required.")
      .max(10_000, "reCAPTCHA token is too long."),
  })
  .strict();


export const launcherLoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
    password: z.string().min(1, "Password is required.").max(128),
  })
  .strict();
