import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import {
  getAccount,
  updateAccount,
  deleteAccount,
  getPublicProfile,
  getPrivacy,
  setPrivacy,
} from '../services/account.service.js';
import {
  requestEmailChange,
} from '../services/account-email.service.js';

export const publicProfile = asyncHandler(async (req, res) => {
  const profile = await getPublicProfile(req.params.username);
  sendSuccess(res, profile);
});

export const show = asyncHandler(async (req, res) => {
  const account = await getAccount(req.session.userId);
  sendSuccess(res, account);
});

export const update = asyncHandler(async (req, res) => {
  const account = await updateAccount(req.session.userId, req.body);
  sendSuccess(res, account);
});

export const remove = asyncHandler(async (req, res) => {
  await deleteAccount(req.session.userId, req.body.password);
  await new Promise((resolve, reject) =>
    req.session.destroy((err) => (err ? reject(err) : resolve()))
  );
  res.clearCookie('deadsmile.sid', {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.cookieSameSite,
    path: '/',
    partitioned: env.isProduction && env.cookieSameSite === 'none',
  });
  sendSuccess(res, { deleted: true });
});
export const changeEmail = asyncHandler(
  async (req, res) => {
    const result = await requestEmailChange(
      req.session.userId,
      req.body,
    );

    sendSuccess(res, result);
  },
);
export const privacy = asyncHandler(
  async (req, res) => {
    const result = await getPrivacy(
      req.session.userId,
    );

    sendSuccess(res, result);
  },
);

export const changePrivacy = asyncHandler(
  async (req, res) => {
    const result = await setPrivacy(
      req.session.userId,
      req.body,
    );

    sendSuccess(res, result);
  },
);