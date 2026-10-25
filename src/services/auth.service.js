import { meetsMinimumAge } from "../utils/age.js";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "../constants/legal.js";
import { AppError } from "../utils/AppError.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  updateLastLogin,
  getLatestLegalAcceptance,
  isCurrentLegalAcceptance,
} from "../repositories/users.repository.js";
import { findTotpByUserId } from "../repositories/totp.repository.js";
import { sendRegistrationEmail } from "./account-email.service.js";

const PERSONALIZED_PROFILE_HANDLES = new Set(["deadsmilegames", "luxjson"]);

const decoyHashPromise = hashPassword(`decoy-${Math.random()}-${Date.now()}`);


export async function registerUser({ username, email, password, dateOfBirth, locale = "en", termsAccepted, privacyAcknowledged, termsVersion, privacyVersion }) {
  if (!meetsMinimumAge(dateOfBirth)) {
    throw new AppError(403, "ACCOUNT_AGE_RESTRICTED");
  }
  if (PERSONALIZED_PROFILE_HANDLES.has(String(username || "").toLowerCase())) {
    throw new AppError(409, "USERNAME_TAKEN");
  }

  const [existingEmail, existingUsername] = await Promise.all([
    findUserByEmail(email),
    findUserByUsername(username),
  ]);

  if (existingEmail) {
    throw new AppError(409, "EMAIL_TAKEN");
  }

  if (existingUsername) {
    throw new AppError(409, "USERNAME_TAKEN");
  }

  const hasAnyAcceptanceField = [
    termsAccepted,
    privacyAcknowledged,
    termsVersion,
    privacyVersion,
  ].some((field) => field !== undefined);
  const legalAcceptanceRequired = process.env.REQUIRE_LEGAL_ACCEPTANCE !== "false";

  if (
    (legalAcceptanceRequired || hasAnyAcceptanceField) &&
    (
      termsAccepted !== true ||
      privacyAcknowledged !== true ||
      termsVersion !== CURRENT_TERMS_VERSION ||
      privacyVersion !== CURRENT_PRIVACY_VERSION
    )
  ) {
    throw new AppError(400, "VALIDATION_ERROR");
  }

  const passwordHash = await hashPassword(password);

  const user = await createUser({
    username,
    email,
    passwordHash,
    dateOfBirth,
    legalAcceptance: hasAnyAcceptanceField
      ? { termsVersion, privacyVersion, locale }
      : null,
  });

  await sendRegistrationEmail(user, locale);

  return {
    verificationRequired: true,
  };
}

export async function authenticateUser({ email, password }) {
  const user = await findUserByEmail(email);

  if (!user) {
    const decoyHash = await decoyHashPromise;
    await verifyPassword(decoyHash, password).catch(() => {});
    throw new AppError(401, "INVALID_CREDENTIALS");
  }
  const valid = await verifyPassword(user.password_hash, password);

  if (!valid) {
    throw new AppError(401, "INVALID_CREDENTIALS");
  }

  if (!user.email_verified_at) {
    throw new AppError(403, "EMAIL_NOT_VERIFIED");
  }

  const totp = await findTotpByUserId(user.id);

  if (totp?.enabled) {
    return { requiresTwoFactor: true, userId: user.id };
  }

  await updateLastLogin(user.id);
  const acceptance = await getLatestLegalAcceptance(user.id);
  return sanitizeUser({
    ...user,
    legal_acceptance_required: !isCurrentLegalAcceptance(acceptance),
  });
}

export async function completeTwoFactorLogin(userId) {
  const user = await findUserById(userId);
  if (!user) throw new AppError(404, "USER_NOT_FOUND");
  if (!user.email_verified_at) throw new AppError(403, "EMAIL_NOT_VERIFIED");

  await updateLastLogin(userId);
  const updatedUser = await findUserById(userId);
  const account = updatedUser || user;
  const acceptance = await getLatestLegalAcceptance(userId);
  return sanitizeUser({
    ...account,
    legal_acceptance_required: !isCurrentLegalAcceptance(acceptance),
  });
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: Boolean(user.email_verified_at),
    shareGameActivity: Boolean(user.share_game_activity),
    sharePlaytime: Boolean(user.share_playtime),
    shareAchievements: Boolean(user.share_achievements),
    username: user.username,
    role: user.role,
    avatarUrl: user.avatar_url || null,
    bio: user.bio || "",
    websiteUrl: user.website_url || null,
    location: user.location || null,
    profileBannerUrl: PERSONALIZED_PROFILE_HANDLES.has(String(user.username || "").toLowerCase())
      ? user.profile_banner_url || null
      : null,
    isVerified: PERSONALIZED_PROFILE_HANDLES.has(String(user.username || "").toLowerCase()),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    lastLoginAt: user.last_login_at,
    legalAcceptanceRequired: Boolean(user.legal_acceptance_required),
  };
}
