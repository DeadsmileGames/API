import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  getAccount,
  updateAccount,
  deleteAccount,
  getPublicProfile,
} from '../services/account.service.js';

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
  res.clearCookie('deadsmile.sid');
  sendSuccess(res, { deleted: true });
});
